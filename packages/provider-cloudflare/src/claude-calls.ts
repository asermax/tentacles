import type { CallId } from "@tentacles/relay-protocol/call-id";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

const callPrefix = "call:";
const lastActivityKey = "lastActivity";
const isStoppingKey = "isStopping";

const decodeTimestamp = Schema.decodeUnknownOption(Schema.Number);
const decodeStopping = Schema.decodeUnknownOption(Schema.Literal(true));

/**
 * The Claude object's count of calls in flight, the time of its last activity and its stopping mark,
 * kept in the object's storage so a new instance takes up where the last one left off. A call is stored
 * as `call:<callId>`, so any such key means a call is in flight.
 */
export const createClaudeCalls = (storage: DurableObjectStorage, idleAfterMs: number) => {
  const { kv } = storage;

  const isStopping = () => Option.isSome(decodeStopping(kv.get(isStoppingKey)));

  const hasCallInFlight = () =>
    !kv.list({ prefix: callPrefix, limit: 1 })[Symbol.iterator]().next().done;

  return {
    add: (callId: CallId) => {
      const now = Date.now();

      kv.put(`${callPrefix}${callId}`, now);
      kv.put(lastActivityKey, now);
    },

    /** Takes a call off the count; a call the object no longer holds changes nothing. */
    remove: (callId: CallId) => {
      if (kv.delete(`${callPrefix}${callId}`)) {
        kv.put(lastActivityKey, Date.now());
      }
    },

    /** Forgets every call, the stopping mark and the last activity, as a container that is gone has none. */
    reset: () => {
      for (const [key] of kv.list({ prefix: callPrefix })) {
        kv.delete(key);
      }

      kv.delete(isStoppingKey);
      kv.delete(lastActivityKey);
    },

    /** Records the time as the last activity of a running container the object has none recorded for. */
    recordFirstActivity: (now: number) => {
      if (Option.isNone(decodeTimestamp(kv.get(lastActivityKey)))) {
        kv.put(lastActivityKey, now);
      }
    },

    isStopping,

    /** Marks the object stopping when the container is unused: no stop decided, no call in flight, and the idle time passed. Reports whether it did. */
    stopIfIdle: (now: number) => {
      const isIdle =
        !isStopping() &&
        !hasCallInFlight() &&
        Option.match(decodeTimestamp(kv.get(lastActivityKey)), {
          onNone: () => false,
          onSome: (lastActivity) => now - lastActivity >= idleAfterMs,
        });

      if (isIdle) {
        kv.put(isStoppingKey, true);
      }

      return isIdle;
    },
  };
};
