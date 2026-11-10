import type { Storage } from "@earendil-works/pi-durable";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

/** pi-durable's storage for one session, as the harness opens it. */
export class SessionStorage extends Context.Service<
  SessionStorage,
  {
    readonly storage: () => Effect.Effect<Storage>;
  }
>()("tentacles/SessionStorage") {}
