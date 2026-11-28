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

type EgressHandler = (request: Request, url: URL) => Effect.Effect<Response, never, RuntimeContext>;

interface EgressDependencies {
  readonly claudeToken: Redacted.Redacted;
  readonly claudeObjects: Cloudflare.DurableObject<ClaudeObject>;
}

interface EgressRoute {
  readonly host: string;
  readonly scheme: "http" | "https";
  readonly handler: (dependencies: EgressDependencies) => EgressHandler;
}

const anthropicHandler =
  ({ claudeToken }: EgressDependencies): EgressHandler =>
  (request) =>
    Effect.promise(() => fetchWithAuthorization(request, `Bearer ${Redacted.value(claudeToken)}`));

const endReportHandler =
  ({ claudeObjects }: EgressDependencies): EgressHandler =>
  (request, url) =>
    Option.match(request.method === "POST" ? parseEndReportPath(url.pathname) : Option.none(), {
      onNone: () => Effect.succeed(new Response("Not found", { status: 404 })),
      onSome: (callId) =>
        claudeObjects
          .getByName(claudeObjectName)
          .callEnded(callId)
          .pipe(Effect.as(new Response(null, { status: 204 })), Effect.orDie),
    });

/** Every host the Claude container's outbound traffic is intercepted for, with the scheme it is intercepted on and the handler that answers it. */
const egressRoutes: ReadonlyArray<EgressRoute> = [
  { host: "api.anthropic.com", scheme: "https", handler: anthropicHandler },
  { host: endReportHost, scheme: "http", handler: endReportHandler },
];

/** Has the container send the traffic of every egress host to the interceptor. */
export const interceptEgressHosts = (
  container: Container,
  interceptor: Parameters<Container["interceptOutboundHttps"]>[1],
) =>
  Promise.all(
    egressRoutes.map(({ host, scheme }) =>
      scheme === "https"
        ? container.interceptOutboundHttps(host, interceptor)
        : container.interceptOutboundHttp(host, interceptor),
    ),
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

    const handlersByHostname = new Map(
      egressRoutes.map(({ host, handler }) => [host, handler({ claudeToken, claudeObjects })]),
    );

    return (request: Request) => {
      const url = new URL(request.url);

      return Option.map(Option.fromNullishOr(handlersByHostname.get(url.hostname)), (handler) =>
        handler(request, url),
      );
    };
  });
