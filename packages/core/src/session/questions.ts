import { defineDoc } from "@earendil-works/pi-durable";
import type { QuestionId } from "@tentacles/worker-api/ids";

export type StoredQuestion = {
  /** The asking tool call's task id. */
  readonly id: QuestionId;
  readonly text: string;
  answer: string | null;
};

// One document for every question of the session, so the status derivation
// observes a single address. A question waits while it has no answer and its
// tool call is still in pi.live.
export const QuestionsDoc = defineDoc<{ questions: StoredQuestion[] }>({
  kind: "tentacles.questions",
  version: 1,
  scope: "session",
  initial: () => ({ questions: [] }),
  checkpointWhen: () => false,
});
