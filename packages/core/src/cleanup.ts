import { RegistryStore } from "@tentacles/contracts/registry-store";
import { SessionHost } from "@tentacles/contracts/session-host";
import type { SessionId } from "@tentacles/worker-api/ids";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";

const monthMillis = 30 * 24 * 60 * 60_000;

// A deletion that fails keeps the entry, so the next day tries it again; the
// loop goes on with the other sessions.
const remove = (sessionId: SessionId) =>
  Effect.gen(function* () {
    yield* (yield* SessionHost).delete(sessionId);
    yield* (yield* RegistryStore).remove(sessionId);
  }).pipe(
    Effect.catchCause((cause) => Effect.logError("Could not delete the session", sessionId, cause)),
  );

/** The daily job: deletes every session whose last run stopped more than a month ago. */
export const cleanup = Effect.gen(function* () {
  const now = yield* Clock.currentTimeMillis;
  const candidates = yield* (yield* RegistryStore).stoppedBefore(now - monthMillis);

  yield* Effect.forEach(candidates, remove, { discard: true });
}).pipe(Effect.catchCause((cause) => Effect.logError("The cleanup job failed", cause)));
