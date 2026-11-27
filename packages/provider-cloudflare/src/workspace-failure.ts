import { WorkspaceSetupError } from "@tentacles/worker-api/errors";
import * as Schema from "effect/Schema";

export const isWorkspaceFailure = Schema.is(WorkspaceSetupError);

/**
 * What the workspace object's setup answers: null once it succeeded, or the failure it ended with.
 * Its encoded form is plain data, which a call to the object carries; the session object decodes it
 * into the typed error.
 */
export const WorkspaceSetupResult = Schema.NullOr(WorkspaceSetupError);

export const encodeSetupResult = Schema.encodeSync(WorkspaceSetupResult);

export const decodeSetupResult = Schema.decodeUnknownEffect(WorkspaceSetupResult);
