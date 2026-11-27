import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Redacted from "effect/Redacted";

import { cdpRelay } from "./browser";
import { githubFetch } from "./github-fetch";
import { apiHost } from "./hosts";

/** What the workspace object mints into the gateway's props, to mark a request as the container's. */
export interface GatewayProps {
  readonly gateway?: string;
}

/** What the gateway reads from the Workspace Worker's bindings. */
export interface GatewayEnvironment {
  readonly TENTACLES_GITHUB_TOKEN: string;
  readonly TENTACLES_CDP_SECRET: string;
  readonly BROWSER: BrowserRun;
}

const cdpPath = /^\/cdp\/([^/]+)$/;

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
    context: ExecutionContext<GatewayProps>,
  ): Promise<Response> {
    if (context.props?.gateway == null) {
      return new Response("Not found", { status: 404 });
    }

    const url = new URL(request.url);

    if (url.hostname === apiHost) {
      const token = cdpPath.exec(url.pathname)?.[1];

      if (token == null) {
        return new Response("Not found", { status: 404 });
      }

      return Effect.runPromise(
        cdpRelay(environment.BROWSER, Redacted.make(environment.TENTACLES_CDP_SECRET))(token),
      ).catch(() => new Response("The browser is unavailable", { status: 502 }));
    }

    return githubFetch(environment.TENTACLES_GITHUB_TOKEN)(request);
  },
};

type GatewayLoopback = (options: { props: GatewayProps }) => Fetcher;

// workers-types types ctx.exports only from a declared main module, which a hand-written one does
// not give it, so the default entrypoint's stub is found by what it is.
const hasGatewayLoopback = (
  exports: Cloudflare.Exports,
): exports is Cloudflare.Exports & { default: GatewayLoopback } =>
  "default" in exports && Predicate.isFunction(exports.default);

/** The stub of this Worker's own gateway, carrying the props that name the workspace it serves. */
export const gatewayStub = (exports: Cloudflare.Exports, workspaceName: string): Fetcher => {
  if (!hasGatewayLoopback(exports)) {
    throw new Error("The Worker exports no default entrypoint");
  }

  return exports.default({ props: { gateway: workspaceName } });
};
