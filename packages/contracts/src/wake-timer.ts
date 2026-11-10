import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

// The one timer that resumes a session after an eviction; nothing else
// schedules on it. `set` takes epoch milliseconds and replaces an armed timer.
export class WakeTimer extends Context.Service<
  WakeTimer,
  {
    readonly set: (at: number) => Effect.Effect<void>;
    readonly clear: () => Effect.Effect<void>;
  }
>()("tentacles/WakeTimer") {}
