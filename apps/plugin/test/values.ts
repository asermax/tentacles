import { Entry } from "@tentacles/worker-api/entries";
import { QuestionId, SessionId } from "@tentacles/worker-api/ids";
import { SessionState } from "@tentacles/worker-api/session-state";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";

import type { CommandResult } from "../src/core/helper-output.ts";

export const {
  running: Running,
  waiting: Waiting,
  idle: Idle,
  failed: Failed,
} = SessionState.cases;

export const { text: TextEntry } = Entry.cases;

export const sessionIdOf = (index: number) =>
  Schema.decodeSync(SessionId)(`00000000-0000-4000-8000-${String(index).padStart(12, "0")}`);

export const questionOf = (id: string, text: string) => ({ id: QuestionId.make(id), text });

/** The message of a HelperError result, or undefined for any other result. */
export const helperErrorMessage = (result: CommandResult) =>
  Predicate.isTagged(result, "HelperError") ? result.message : undefined;
