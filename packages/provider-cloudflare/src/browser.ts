import { Browser } from "@tentacles/contracts/browser";
import * as Effect from "effect/Effect";
import { Base64Url } from "effect/encoding";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";

import { apiHost } from "./hosts.ts";

// Browser Run's maximum: the session closes after 20 minutes without a CDP message.
const keepAlive = 20 * 60_000;

const browserSessionKey = "browser-session";

const encoder = new TextEncoder();

const hmacKey = (secret: Redacted.Redacted) =>
  crypto.subtle.importKey(
    "raw",
    encoder.encode(Redacted.value(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

// A token is the Browser Run session id and its HMAC under the Worker secret, so only the Worker
// mints one and the relay keeps no state of its own.
const signToken = async (secret: Redacted.Redacted, browserSessionId: string) => {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    encoder.encode(browserSessionId),
  );

  return `${browserSessionId}.${Base64Url.encode(new Uint8Array(signature))}`;
};

/** The Browser Run session id a token names, when its signature holds. */
const verifyToken = async (secret: Redacted.Redacted, token: string) => {
  const separator = token.lastIndexOf(".");

  if (separator === -1) {
    return Option.none<string>();
  }

  const browserSessionId = token.slice(0, separator);
  const signature = Base64Url.decode(token.slice(separator + 1));

  if (Result.isFailure(signature)) {
    return Option.none<string>();
  }

  const isSigned = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    signature.success,
    encoder.encode(browserSessionId),
  );

  return isSigned ? Option.some(browserSessionId) : Option.none<string>();
};

const closeQuietly = (browser: BrowserRun, browserSessionId: string) =>
  browser.closeSession(browserSessionId).catch(() => {});

/**
 * One session's browser: a Browser Run session acquired through the binding, its id kept in the
 * session object's storage so close finds it after an eviction. The caller closes the previous one
 * before opening another.
 */
export const browserLayer = (
  browser: BrowserRun,
  secret: Redacted.Redacted,
  storage: DurableObjectStorage,
) => {
  const close = Effect.promise(async () => {
    const browserSessionId = storage.kv.get<string>(browserSessionKey);

    if (browserSessionId == null) {
      return;
    }

    await closeQuietly(browser, browserSessionId);
    storage.kv.delete(browserSessionKey);
  });

  return Layer.succeed(
    Browser,
    Browser.of({
      open: () =>
        Effect.promise(async () => {
          const { sessionId } = await browser.acquire({ keepAlive });

          storage.kv.put(browserSessionKey, sessionId);

          return { cdpUrl: `wss://${apiHost}/cdp/${await signToken(secret, sessionId)}` };
        }),
      close: () => close,
    }),
  );
};

// 1005 means no code was sent, which close() does not accept.
const forwardClose = (to: WebSocket) => (event: CloseEvent) =>
  to.close(event.code === 1005 ? 1000 : event.code, event.reason);

/**
 * The /cdp route: checks the token and bridges the caller's WebSocket to the Browser Run session it
 * names. agent-browser cannot trust the egress CA on its CDP connection, so the container reaches
 * the browser through the Worker's own certificate instead.
 */
export const cdpRelay = (browser: BrowserRun, secret: Redacted.Redacted) => (token: string) =>
  Effect.promise(async () => {
    const browserSessionId = await verifyToken(secret, token);

    if (Option.isNone(browserSessionId)) {
      return new Response("Not found", { status: 404 });
    }

    const connection = await browser.connectSession(browserSessionId.value);

    const upstream = await connection.webSocket.fetch("https://browser/", {
      headers: { Upgrade: "websocket" },
    });

    const remote = upstream.webSocket;

    if (remote == null) {
      return new Response(`Browser Run refused the session: ${upstream.status}`, { status: 502 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const local = pair[1];

    remote.accept();
    local.accept();

    remote.addEventListener("message", (event) => local.send(event.data));
    local.addEventListener("message", (event) => remote.send(event.data));

    remote.addEventListener("close", forwardClose(local));
    local.addEventListener("close", forwardClose(remote));

    return new Response(null, { status: 101, webSocket: client });
  });
