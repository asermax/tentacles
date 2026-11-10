import { SessionNotFound, TentaclesError } from "@tentacles/worker-api/errors";
import { SessionId } from "@tentacles/worker-api/ids";
import { SessionState } from "@tentacles/worker-api/session-state";
import * as Schema from "effect/Schema";

export const StateLine = Schema.Struct({
  sessionId: SessionId,
  state: SessionState,
});

export type StateLine = typeof StateLine.Type;

/** A session whose socket answered that it does not exist. */
export const MissingLine = Schema.Struct({
  sessionId: SessionId,
  error: SessionNotFound,
});

export type MissingLine = typeof MissingLine.Type;

/** One line the helper's watch prints per SessionState, or once for a session that does not exist. */
export const WatchLine = Schema.Union([StateLine, MissingLine]);

export type WatchLine = typeof WatchLine.Type;

export const WatchLineJson = Schema.fromJsonString(WatchLine);

/** The endpoint's success, as JSON. */
export const Success = Schema.TaggedStruct("Success", {
  result: Schema.Unknown,
});

export const Failure = Schema.TaggedStruct("Failure", {
  error: TentaclesError,
});

/** A failure that is not the Worker's: it did not answer, it answered an unexpected status, or a variable is missing. */
export const HelperError = Schema.TaggedStruct("HelperError", {
  message: Schema.String,
});

export const CommandResult = Schema.Union([Success, Failure, HelperError]);

export type CommandResult = typeof CommandResult.Type;

export const CommandResultJson = Schema.fromJsonString(CommandResult);
