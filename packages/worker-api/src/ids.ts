import * as Schema from "effect/Schema";

export const SessionId = Schema.String.check(Schema.isUUID()).pipe(Schema.brand("SessionId"));

export type SessionId = typeof SessionId.Type;

/** The parent harness's own session id. */
export const ParentSessionId = Schema.String.pipe(Schema.brand("ParentSessionId"));

export type ParentSessionId = typeof ParentSessionId.Type;

export const QuestionId = Schema.String.pipe(Schema.brand("QuestionId"));

export type QuestionId = typeof QuestionId.Type;
