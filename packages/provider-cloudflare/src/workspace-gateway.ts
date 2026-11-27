import * as Predicate from "effect/Predicate";
import * as Redacted from "effect/Redacted";

import { cdpRelay, cdpTokenOf } from "./browser";
import { githubFetch } from "./github-fetch";
import { apiHost } from "./hosts";

/** What the workspace object mints into the gateway's props, to mark a request as the container's. */
export interface GatewayProps {
  readonly isGateway: true;
}

/** What the gateway reads from the Workspace Worker's bindings. */
export interface GatewayEnvironment {
  readonly TENTACLES_GITHUB_TOKEN: string;
  readonly TENTACLES_CDP_SECRET: string;
  readonly BROWSER: BrowserRun;
}

/**
 * The Workspace Worker's default entrypoint: the container's http-gateway, which every outbound
 * request of the container reaches, routed by its host. github.com gets the deploy's token, the
 * API host's /cdp/<token> path reaches the session's browser, and every other host is passed
 * through unchanged.
 */
export const gateway = {
  async fetch(
    request: Request,
    environment: GatewayEnvironment,
    context: ExecutionContext<GatewayProps | undefined>,
  ): Promise<Response> {
    if (context.props?.isGateway !== true) {
      return new Response("Not found", { status: 404 });
    }

    const url = new URL(request.url);

    if (url.hostname === apiHost) {
      const cdpToken = cdpTokenOf(url.pathname);

      if (cdpToken == null) {
        return new Response("Not found", { status: 404 });
      }

      return cdpRelay(
        environment.BROWSER,
        Redacted.make(environment.TENTACLES_CDP_SECRET),
      )(cdpToken).catch(() => new Response("The browser is unavailable", { status: 502 }));
    }

    return githubFetch(environment.TENTACLES_GITHUB_TOKEN)(request);
  },
};

type GatewayLoopback = (options: { props: GatewayProps }) => Fetcher;

/** The stub of this Worker's own gateway, carrying the props that mark its requests as the container's. */
export const gatewayStub = (exports: Cloudflare.Exports): Fetcher => {
  const entrypoint: unknown = "default" in exports ? exports.default : undefined;

  if (!Predicate.isFunction(entrypoint)) {
    throw new Error("The Worker exports no default entrypoint");
  }

  // SAFETY: workers-types types ctx.exports only from a declared main module, which a hand-written
  // one does not give it. The default entrypoint of this Worker is the gateway, whose loopback
  // takes the props and answers a Fetcher, and calling it is the only way to check.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (entrypoint as GatewayLoopback)({ props: { isGateway: true } });
};
