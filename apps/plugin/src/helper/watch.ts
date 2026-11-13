import { SessionNotFound } from "@tentacles/worker-api/errors";
import type { SessionId } from "@tentacles/worker-api/ids";
import { SessionState, SessionStatuses } from "@tentacles/worker-api/session-state";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";

import { MissingLine, StateLine, type WatchLine } from "../core/helper-output.ts";
import { openSessionSocket, TentaclesClient, TentaclesClientLive } from "./client.ts";

const decodeState = Schema.decodeUnknownEffect(Schema.fromJsonString(SessionState));

const textDecoder = new TextDecoder();

const reconnectAfter = "5 seconds";

// Only a session already idle when the socket connects lacks its last entry:
// the idle a finishing run sends carries it.
const withLastEntry = (sessionId: SessionId, state: SessionState) =>
  Effect.gen(function* () {
    if (!Predicate.isTagged(state, SessionStatuses.idle) || state.lastEntry != null) {
      return state;
    }

    const client = yield* TentaclesClient;
    const entries = yield* client.sessions.messages({ params: { sessionId }, query: { count: 1 } });

    return Option.match(Option.fromNullishOr(entries.at(-1)), {
      onNone: () => state,
      onSome: (lastEntry) => SessionState.cases.idle.make({ ...state, lastEntry }),
    });
  });

const connection = (sessionId: SessionId, print: (line: WatchLine) => Effect.Effect<void>) =>
  Effect.gen(function* () {
    const socket = yield* openSessionSocket(sessionId);
    const reader = yield* socket.reader;
    let isConnected = false;

    while (true) {
      for (const chunk of yield* reader.pull) {
        const received = yield* decodeState(
          Predicate.isString(chunk) ? chunk : textDecoder.decode(chunk),
        );

        const state = isConnected ? received : yield* withLastEntry(sessionId, received);

        isConnected = true;
        yield* print(StateLine.make({ sessionId, state }));
      }
    }
  }).pipe(Effect.scoped);

/**
 * Holds one session's socket and prints a line per state. When the socket
 * cannot open or drops, the status call tells a session that does not exist,
 * which ends its watch with a failure line, from one to reconnect to.
 */
const watchSession = (sessionId: SessionId, print: (line: WatchLine) => Effect.Effect<void>) =>
  Effect.gen(function* () {
    while (true) {
      yield* Effect.exit(connection(sessionId, print));

      const client = yield* TentaclesClient;

      const missing = yield* client.sessions.status({ params: { sessionId } }).pipe(
        Effect.as(false),
        Effect.catchTag("SessionNotFound", () => Effect.succeed(true)),
        Effect.orElseSucceed(() => false),
      );

      if (missing) {
        return yield* print(
          MissingLine.make({ sessionId, error: new SessionNotFound({ sessionId }) }),
        );
      }

      yield* Effect.sleep(reconnectAfter);
    }
  }).pipe(Effect.orElseSucceed(() => undefined));

/** One socket per session, each printing its own lines; the other sockets go on when one ends. */
export const watchSessions = (
  sessionIds: ReadonlyArray<SessionId>,
  print: (line: WatchLine) => Effect.Effect<void>,
) =>
  Effect.forEach(sessionIds, (sessionId) => watchSession(sessionId, print), {
    concurrency: "unbounded",
    discard: true,
  }).pipe(
    Effect.provide(TentaclesClientLive),
    Effect.orElseSucceed(() => undefined),
  );
