import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

const attempts = 1000;

/**
 * Runs an assertion every 10 ms until it passes, for up to ten seconds; a
 * failed `expect` inside it counts as not yet.
 */
export const eventually = <A, E, R>(assertion: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    for (let attempt = 1; ; attempt++) {
      const exit = yield* Effect.exit(assertion);

      if (Exit.isSuccess(exit) || attempt === attempts) {
        return yield* exit;
      }

      yield* Effect.sleep("10 millis");
    }
  });
