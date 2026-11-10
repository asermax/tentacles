import type { SessionState } from "@tentacles/worker-api/session-state";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

/** The sockets the parent holds open on one session; sending with none open is not an error. */
export class ParentChannel extends Context.Service<
  ParentChannel,
  {
    readonly send: (state: SessionState) => Effect.Effect<void>;
  }
>()("tentacles/ParentChannel") {}
