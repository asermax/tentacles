import * as Schema from "effect/Schema";

import { QuestionId, SessionId } from "./ids";

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

export class InvalidWorkspace extends Schema.TaggedError<InvalidWorkspace>()(
  "InvalidWorkspace",
  { message: Schema.String },
  { httpApiStatus: 400 },
) {}

export class WorkspaceUnavailable extends Schema.TaggedError<WorkspaceUnavailable>()(
  "WorkspaceUnavailable",
  { message: Schema.String },
  { httpApiStatus: 500 },
) {}

const workspaceSetupErrors = [InvalidWorkspace, WorkspaceUnavailable] as const;

/** What a workspace's setup fails with. */
export const WorkspaceSetupError = Schema.Union(workspaceSetupErrors);

export type WorkspaceSetupError = typeof WorkspaceSetupError.Type;

/**
 * What creating a session fails with: an archive that cannot be read, or a setup that fails. Its
 * members are the classes themselves, which is what an endpoint's error list needs to answer each
 * with its own status.
 */
export const CreateSessionError = Schema.Union([InvalidArchive, ...workspaceSetupErrors]);

export type CreateSessionError = typeof CreateSessionError.Type;

/** Every error the API returns; the helper's command result carries it. */
export const TentaclesError = Schema.Union([
  SessionNotFound,
  QuestionNotWaiting,
  Unauthorized,
  CreateSessionError,
]);

export type TentaclesError = typeof TentaclesError.Type;
