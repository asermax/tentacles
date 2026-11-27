import { WorkspaceSetupError, WorkspaceUnavailable } from "@tentacles/worker-api/errors";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";

export const isWorkspaceFailure = Schema.is(WorkspaceSetupError);

const decodeWorkspaceFailure = Schema.decodeUnknownOption(WorkspaceSetupError);

const reasonPattern = /^(\w+): ([\s\S]*)$/;

/** The reason a workspace object aborts with when it destroys itself, which rejects the destroy call. */
export const destroyedReason = "workspace deleted";

// A workspace object that resets itself aborts, and the call it aborts rejects with the abort's
// reason as an error message, so the reason is what carries the failure to the session object.
/** The text a workspace object aborts with to fail a call with `failure`. */
export const failureReason = ({ _tag, message }: WorkspaceSetupError) => `${_tag}: ${message}`;

/**
 * The failure a rejected call to a workspace object stands for: the one its abort reason carries,
 * and WorkspaceUnavailable for any other cause.
 */
export const failureOf = (cause: unknown): WorkspaceSetupError => {
  const causeMessage = Predicate.isError(cause) ? cause.message : String(cause);
  const [, _tag, failureMessage = causeMessage] = reasonPattern.exec(causeMessage) ?? [];

  return Option.getOrElse(
    decodeWorkspaceFailure({ _tag, message: failureMessage }),
    () => new WorkspaceUnavailable({ message: causeMessage }),
  );
};
