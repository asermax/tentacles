import * as CloudflareProvider from "@tentacles/provider-cloudflare";
import * as Alchemy from "alchemy";
import * as Schema from "effect/Schema";

// One provider per deploy; adding one is a name here and its package below.
const Provider = Schema.Literals(["cloudflare"]);

const deployments: Record<typeof Provider.Type, typeof CloudflareProvider> = {
  cloudflare: CloudflareProvider,
};

const { providers, stack } =
  deployments[Schema.decodeUnknownSync(Provider)(process.env.TENTACLES_PROVIDER)];

// State stays on this machine, in the ignored .alchemy folder.
export default Alchemy.Stack(
  "tentacles",
  { providers: providers(), state: Alchemy.localState() },
  stack,
);
