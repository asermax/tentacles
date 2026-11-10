import * as Cloudflare from "@alchemy.run/cloudflare";
import { Scheduler } from "@tentacles/contracts/scheduler";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

// Once a day, at 04:00 UTC.
const daily = "0 4 * * *";

/**
 * The cron unit, run in the Worker's init: at plan time it adds the trigger to the Worker, at run
 * time it registers the listener. Jobs live in the isolate, so they are registered during init, in
 * every isolate; each runs inside the firing event, which carries the RuntimeContext the calls to
 * the objects need.
 */
export const cloudflareScheduler = Effect.gen(function* () {
  const jobs: Array<Effect.Effect<void>> = [];

  yield* Cloudflare.Workers.cron(daily, () =>
    Effect.forEach(jobs, (job) => job, { discard: true }),
  );

  return Layer.succeed(
    Scheduler,
    Scheduler.of({
      daily: (job) =>
        Effect.sync(() => {
          jobs.push(job);
        }),
    }),
  );
});
