import * as Cloudflare from "@alchemy.run/cloudflare";
import { SessionId } from "@tentacles/worker-api/ids";
import type { RuntimeContext } from "alchemy/RuntimeContext";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import type { SessionObject } from "./session-object.ts";

/** Where Cloudflare writes the CA a container's intercepted HTTPS is signed with; both images trust it. */
export const egressCaPath = "/etc/cloudflare/certs/cloudflare-containers-ca.crt";

/** What the images send in place of a credential; the egress handler sends the real one instead. */
export const credentialPlaceholder = "tentacles-egress-credential";

export const EgressHosts = {
  github: "github.com",
  anthropic: "api.anthropic.com",
  lifetime: "tentacles.internal",
} as const;

/** The props a workspace's loopback stub carries, so the lifetime ping reaches its own session. */
export const EgressProps = Schema.Struct({ sessionId: SessionId });

export type EgressProps = typeof EgressProps.Type;

const decodeProps = Schema.decodeUnknownEffect(EgressProps);

/**
 * The interceptor a container's outbound requests go to: the Worker's own default entrypoint, since
 * an Effect Worker exports no named entrypoint. A workspace passes its session in the props.
 */
export const loopback = (state: Cloudflare.DurableObjectState["Service"], props?: EgressProps) => {
  const entrypoint = state.exports.default;

  return entrypoint == null
    ? Effect.die(new Error("The Worker exports no default entrypoint"))
    : entrypoint(props == null ? {} : { props }).pipe(
        Effect.map((fetcher) => fetcher.raw),
        Effect.orDie,
      );
};

const withAuthorization = (request: Request, authorization: string) => {
  const headers = new Headers(request.headers);

  headers.set("authorization", authorization);

  return fetch(new Request(request, { headers }));
};

const forward = (request: Request, authorization: string) =>
  Effect.promise(() => withAuthorization(request, authorization));

/**
 * The containers' outbound traffic: each host's handler, run by the Worker's default entrypoint,
 * which the containers reach through their loopback interceptors. Runs in the Worker's init.
 */
export const egress = (sessions: Cloudflare.DurableObject<SessionObject>) => {
  const lifetime = (request: Request) =>
    Effect.gen(function* () {
      const url = new URL(request.url);

      if (url.pathname !== "/lifetime") {
        return new Response("Not found", { status: 404 });
      }

      const context = yield* Cloudflare.WorkerExecutionContext;
      const { sessionId } = yield* context.props.pipe(Effect.flatMap(decodeProps), Effect.orDie);

      const isNeeded = yield* sessions
        .getByName(sessionId)
        .workspaceNeeded(url.searchParams.get("pendingWork") === "true");

      return new Response(isNeeded ? "yes" : "no");
    });

  return Effect.gen(function* () {
    const githubToken = yield* Config.Redacted("TENTACLES_GITHUB_TOKEN");
    const claudeToken = yield* Config.Redacted("TENTACLES_CLAUDE_TOKEN");

    // git sends credentials only after a 401, and GitHub answers anonymous requests from the
    // containers' shared addresses with 429, so every request carries the token, not only the
    // ones that carry the placeholder.
    const github = (request: Request) =>
      forward(request, `Basic ${btoa(`x-access-token:${Redacted.value(githubToken)}`)}`);

    const anthropic = (request: Request) =>
      forward(request, `Bearer ${Redacted.value(claudeToken)}`);

    const handlers = new Map<
      string,
      (request: Request) => Effect.Effect<Response, never, RuntimeContext>
    >([
      [EgressHosts.github, github],
      [EgressHosts.anthropic, anthropic],
      [EgressHosts.lifetime, lifetime],
    ]);

    return (request: Request) =>
      Option.map(Option.fromNullishOr(handlers.get(new URL(request.url).hostname)), (handler) =>
        handler(request),
      );
  });
};
