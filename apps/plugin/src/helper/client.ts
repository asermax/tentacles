import { TentaclesApi } from "@tentacles/worker-api/api";
import type { SessionId } from "@tentacles/worker-api/ids";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Predicate from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import { HttpApiClient } from "effect/http-api";
import * as Socket from "effect/socket/Socket";

import { ConnectionConfig } from "./config";

const makeClient = Effect.gen(function* () {
  const { url, apiKey } = yield* ConnectionConfig;

  return yield* HttpApiClient.make(TentaclesApi, {
    baseUrl: url,
    transformClient: HttpClient.mapRequest(HttpClientRequest.bearerToken(Redacted.value(apiKey))),
  });
});

/** The typed Worker API client, sending the API key as a bearer token. */
export class TentaclesClient extends Context.Service<
  TentaclesClient,
  Effect.Success<typeof makeClient>
>()("tentacles/plugin/TentaclesClient") {}

export const TentaclesClientLive = Layer.effect(TentaclesClient, makeClient);

/**
 * Opens a session's socket on the URL the API declares for it. A WebSocket
 * from a browser cannot set headers, but the one Node ships can, so the key
 * goes in the Authorization header as on every other endpoint.
 */
export const openSessionSocket = (sessionId: SessionId) =>
  Effect.gen(function* () {
    const { url, apiKey } = yield* ConnectionConfig;

    const httpUrl = HttpApiClient.urlBuilder(TentaclesApi, { baseUrl: url }).sessions.socket({
      params: { sessionId },
    });

    return yield* Socket.makeWebSocket(httpUrl.replace(/^http/, "ws"), {
      headers: { authorization: `Bearer ${Redacted.value(apiKey)}` },
    });
  });

/**
 * Node's own WebSocket (undici) takes headers, which the browser's cannot, so
 * the socket carries the key like every other request. Effect's global layer
 * refuses any options, so this one hands them through.
 */
export const NodeWebSocketConstructor = Layer.succeed(Socket.WebSocketConstructor)(
  (url, options) =>
    new globalThis.WebSocket(
      url,
      // The socket opens with headers only; it names no subprotocol.
      options == null || Predicate.isString(options) || Array.isArray(options)
        ? options
        : { headers: options.headers ?? {} },
    ),
);
