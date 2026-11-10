import * as Schema from "effect/Schema";

import { Entry } from "./entries.ts";
import { QuestionId, SessionId } from "./ids.ts";

export const SessionStatuses = {
  running: "running",
  waiting: "waiting",
  idle: "idle",
  failed: "failed",
  closed: "closed",
} as const;

export const SessionStatus = Schema.Enum(SessionStatuses);

export type SessionStatus = typeof SessionStatus.Type;

export const Question = Schema.Struct({
  id: QuestionId,
  text: Schema.String,
});

export type Question = typeof Question.Type;

// The idle state carries the run's last entry only when it is sent because a
// run just finished; on connect and from status it has none.
export const SessionState = Schema.Union([
  Schema.TaggedStruct(SessionStatuses.running, {}),
  Schema.TaggedStruct(SessionStatuses.waiting, { question: Question }),
  Schema.TaggedStruct(SessionStatuses.idle, { lastEntry: Schema.optionalKey(Entry) }),
  Schema.TaggedStruct(SessionStatuses.failed, { failure: Schema.String }),
  Schema.TaggedStruct(SessionStatuses.closed, {}),
]).pipe(Schema.toTaggedUnion("_tag"));

export type SessionState = typeof SessionState.Type;

/** The registry's status for a state. */
export const statusOf = (state: SessionState): SessionStatus =>
  SessionState.match(state, {
    running: () => SessionStatuses.running,
    waiting: () => SessionStatuses.waiting,
    idle: () => SessionStatuses.idle,
    failed: () => SessionStatuses.failed,
    closed: () => SessionStatuses.closed,
  });

/** A session is active while it runs or waits on a question. */
export const isActive = SessionState.isAnyOf([SessionStatuses.running, SessionStatuses.waiting]);

export const SessionRef = Schema.Struct({
  sessionId: SessionId,
  name: Schema.String,
  status: SessionStatus,
});

export type SessionRef = typeof SessionRef.Type;
