import * as Cloudflare from "@alchemy.run/cloudflare";
import type { RuntimeContext } from "alchemy/RuntimeContext";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";

import { fetchWithAuthorization } from "./github-fetch";

/** Where Cloudflare writes the CA a container's intercepted HTTPS is signed with; the Claude and workspace images trust it. */
export const egressCaPath = "/etc/cloudflare/certs/cloudflare-containers-ca.crt";

/** What the Claude image sends in place of a credential; the egress handler sends the real one instead. */
export const credentialPlaceholder = "tentacles-egress-credential";

export const EgressHosts = {
  anthropic: "api.anthropic.com",
  internal: "tentacles.internal",
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

/**
 * The Claude container's outbound traffic: the anthropic handler, run by the Worker's default
 * entrypoint, which the container reaches through its loopback interceptor. The workspace
 * containers' traffic goes to the Workspace Worker's gateway instead. Runs in the Worker's init.
 */
export const egress = Effect.gen(function* () {
  const claudeToken = yield* Config.Redacted("TENTACLES_CLAUDE_TOKEN");

  return (request: Request): Option.Option<Effect.Effect<Response, never, RuntimeContext>> =>
    new URL(request.url).hostname === EgressHosts.anthropic
      ? Option.some(
          Effect.promise(() =>
            fetchWithAuthorization(request, `Bearer ${Redacted.value(claudeToken)}`),
          ),
        )
      : Option.none();
});
