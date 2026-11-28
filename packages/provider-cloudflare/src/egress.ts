import * as Cloudflare from "@alchemy.run/cloudflare";
import type { RuntimeContext } from "alchemy/RuntimeContext";
import { endReportHost, parseEndReportPath } from "@tentacles/relay-protocol/end-report";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";

import { claudeObjectName } from "./claude-names";
import type { ClaudeObject } from "./claude-object";
import { fetchWithAuthorization } from "./github-fetch";

/** Where Cloudflare writes the CA a container's intercepted HTTPS is signed with; the Claude and workspace images trust it. */
export const egressCaPath = "/etc/cloudflare/certs/cloudflare-containers-ca.crt";

/** What the Claude image sends in place of a credential; the egress handler sends the real one instead. */
export const credentialPlaceholder = "tentacles-egress-credential";

export const EgressHosts = {
  anthropic: "api.anthropic.com",
  endReport: endReportHost,
} as const;

/**
 * The interceptor the Claude container's outbound requests go to: the Worker's own default
 * entrypoint, since an Effect Worker exports no named entrypoint.
 */
export const loopback = (state: Cloudflare.DurableObjectState["Service"]) => {
  const entrypoint = state.exports.default;

  return entrypoint == null
    ? Effect.die(new Error("The Worker exports no default entrypoint"))
    : entrypoint({}).pipe(
        Effect.map((fetcher) => fetcher.raw),
        Effect.orDie,
      );
};

type EgressHandler = (request: Request) => Effect.Effect<Response, never, RuntimeContext>;

const endReportHandler =
  (claudeObjects: Cloudflare.DurableObject<ClaudeObject>): EgressHandler =>
  (request) =>
    Option.match(
      request.method === "POST" ? parseEndReportPath(new URL(request.url).pathname) : Option.none(),
      {
        onNone: () => Effect.succeed(new Response("Not found", { status: 404 })),
        onSome: (callId) =>
          claudeObjects
            .getByName(claudeObjectName)
            .callEnded(callId)
            .pipe(Effect.as(new Response(null, { status: 204 })), Effect.orDie),
      },
    );

/**
 * The Claude container's outbound traffic, run by the Worker's default entrypoint, which the container
 * reaches through its loopback interceptors: a handler per host. api.anthropic.com gets the
 * subscription token. tentacles.internal takes the relay's end report, `POST /claude/calls/<callId>/end`,
 * and tells the Claude object the call ended. The workspace containers' traffic goes to the Workspace
 * Worker's gateway instead. Runs in the Worker's init.
 */
export const egress = (claudeObjects: Cloudflare.DurableObject<ClaudeObject>) =>
  Effect.gen(function* () {
    const claudeToken = yield* Config.Redacted("TENTACLES_CLAUDE_TOKEN");

    const anthropicHandler: EgressHandler = (request) =>
      Effect.promise(() =>
        fetchWithAuthorization(request, `Bearer ${Redacted.value(claudeToken)}`),
      );

    const handlersByHostname = new Map<string, EgressHandler>([
      [EgressHosts.anthropic, anthropicHandler],
      [EgressHosts.endReport, endReportHandler(claudeObjects)],
    ]);

    return (request: Request) =>
      Option.map(
        Option.fromNullishOr(handlersByHostname.get(new URL(request.url).hostname)),
        (handler) => handler(request),
      );
  });
