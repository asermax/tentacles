import { RegistryStore } from "@tentacles/contracts/registry-store";
import { SessionHost } from "@tentacles/contracts/session-host";
import type { SessionId } from "@tentacles/worker-api/ids";
import * as Effect from "effect/Effect";

/**
 * Deletes one session and then its registry entry. The entry goes only after the session is gone,
 * so a deletion that fails keeps it and a later call tries again. SessionHost.delete fails only as
 * a defect.
 */
export const deleteSession = (sessionId: SessionId) =>
  Effect.gen(function* () {
    yield* (yield* SessionHost).delete(sessionId);
    yield* (yield* RegistryStore).remove(sessionId);
  });
