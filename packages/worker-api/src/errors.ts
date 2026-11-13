import * as Schema from "effect/Schema";

import { QuestionId, SessionId } from "./ids.ts";

export class SessionNotFound extends Schema.TaggedError<SessionNotFound>()(
  "SessionNotFound",
  { sessionId: SessionId },
  { httpApiStatus: 404 },
) {}

export class QuestionNotWaiting extends Schema.TaggedError<QuestionNotWaiting>()(
  "QuestionNotWaiting",
  { questionId: QuestionId },
  { httpApiStatus: 409 },
) {}

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
  { httpApiStatus: 401 },
) {}

export class InvalidArchive extends Schema.TaggedError<InvalidArchive>()(
  "InvalidArchive",
  { message: Schema.String },
  { httpApiStatus: 400 },
) {}

/** Every error the API returns; the helper's command result carries it. */
export const TentaclesError = Schema.Union([
  SessionNotFound,
  QuestionNotWaiting,
  Unauthorized,
  InvalidArchive,
]);

export type TentaclesError = typeof TentaclesError.Type;
