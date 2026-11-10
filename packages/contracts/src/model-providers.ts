import type { Models } from "@earendil-works/pi-ai";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

/** Every model provider a session's settings can name, the Claude relay and the gateway's. */
export class ModelProviders extends Context.Service<
  ModelProviders,
  {
    readonly models: () => Effect.Effect<Models>;
  }
>()("tentacles/ModelProviders") {}
