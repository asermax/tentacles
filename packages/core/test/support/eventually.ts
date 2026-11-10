import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";

/**
 * Runs an assertion every 10 ms until it passes, for up to ten seconds; a
 * failed `expect` inside it counts as not yet.
 */
export const eventually = <A, E, R>(assertion: Effect.Effect<A, E, R>) =>
  assertion.pipe(
    // A thrown `expect` is a defect, which `retry` never retries; sandboxing moves
    // the whole cause into the error channel, and the last one is restored at the end.
    Effect.sandbox,
    Effect.retry({ schedule: Schedule.spaced("10 millis"), times: 999 }),
    Effect.catch(Effect.failCause),
  );
