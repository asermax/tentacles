import { SessionRef } from "@tentacles/worker-api/session-state";
import * as Schema from "effect/Schema";

/** What the glue stores per harness session: the parent's remote sessions, closed ones included. */
export const LocalState = Schema.Struct({
  sessions: Schema.Array(SessionRef),
});

export type LocalState = typeof LocalState.Type;

export const LocalStateJson = Schema.fromJsonString(LocalState);
