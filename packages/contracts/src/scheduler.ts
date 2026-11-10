import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

/** Runs a job on a schedule; the setup's stack registers core's cleanup job once. */
export class Scheduler extends Context.Service<
  Scheduler,
  {
    readonly daily: (job: Effect.Effect<void>) => Effect.Effect<void>;
  }
>()("tentacles/Scheduler") {}
