import { InvalidWorkspace, WorkspaceUnavailable } from "@tentacles/worker-api/errors";
import * as Match from "effect/Match";
import * as Predicate from "effect/Predicate";

type WorkspaceFailure = InvalidWorkspace | WorkspaceUnavailable;

const reasonPattern = /^(InvalidWorkspace|WorkspaceUnavailable): ([\s\S]*)$/;

// A workspace object that resets itself aborts, and the call it aborts rejects with the abort's
// reason as an error message, so the reason is what carries the failure to the session object.
/** The text a workspace object aborts with to fail a call with `failure`. */
export const failureReason = (failure: WorkspaceFailure) =>
  Match.valueTags(failure, {
    InvalidWorkspace: ({ message }) => `InvalidWorkspace: ${message}`,
    WorkspaceUnavailable: ({ message }) => `WorkspaceUnavailable: ${message}`,
  });

/**
 * The failure a rejected call to a workspace object stands for: the one its abort reason carries,
 * and WorkspaceUnavailable for any other cause.
 */
export const failureOf = (cause: unknown): WorkspaceFailure => {
  const message = Predicate.isError(cause) ? cause.message : String(cause);
  const [, tag, text = message] = reasonPattern.exec(message) ?? [];

  return tag === "InvalidWorkspace"
    ? new InvalidWorkspace({ message: text })
    : new WorkspaceUnavailable({ message: text });
};
