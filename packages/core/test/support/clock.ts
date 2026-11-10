import * as Clock from "effect/Clock";
import type * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { TestClock } from "effect/testing";

/** Runs an effect on a clock that reads `ahead` past the real time now. */
export const later =
  (ahead: Duration.Input) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.flatMap(Clock.currentTimeMillis, (now) =>
      Effect.gen(function* () {
        yield* TestClock.setTime(now);
        yield* TestClock.adjust(ahead);

        return yield* effect;
      }).pipe(Effect.provide(TestClock.layer())),
    );
