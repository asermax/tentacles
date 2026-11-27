import * as Predicate from "effect/Predicate";

/** What the workspace object mints into the gateway's props, to mark a request as the container's. */
export interface GatewayProps {
  readonly gateway?: string;
}

/** The Workspace Worker's default entrypoint: the container's http-gateway. */
export const gateway = {
  async fetch(
    request: Request,
    _environment: Cloudflare.Env,
    context: ExecutionContext<GatewayProps>,
  ): Promise<Response> {
    return context.props?.gateway == null
      ? new Response("Not found", { status: 404 })
      : fetch(request);
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
