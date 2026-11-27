import type { Entry } from "@tentacles/worker-api/entries";
import type { Question, SessionRef } from "@tentacles/worker-api/session-state";
import * as Match from "effect/Match";

const agentOf = (session: SessionRef) =>
  `Remote agent "${session.name}" (session ${session.sessionId})`;

const entryText = Match.type<Entry>().pipe(
  Match.tagsExhaustive({
    prompt: (entry) => entry.text,
    text: (entry) => entry.text,
    toolCall: (entry) => `a call to ${entry.name}`,
    toolResult: (entry) => entry.output,
    subagentResult: (entry) => entry.text,
  }),
);

export const questionWake = (session: SessionRef, question: Question): string =>
  `${agentOf(session)} asks (question ${question.id}):\n${question.text}\n\nAnswer it with the answer tool, passing session ${session.sessionId} and question ${question.id}.`;

export const finishWake = (session: SessionRef, lastEntry: Entry | undefined): string =>
  lastEntry == null
    ? `${agentOf(session)} finished. Read its last message with the messages tool.`
    : `${agentOf(session)} finished. Its last message:\n${entryText(lastEntry)}`;

export const failureWake = (session: SessionRef, failure: string): string =>
  `${agentOf(session)} failed: ${failure}`;
