import type { ConversationId, EntryId, TaskId } from "@earendil-works/pi-durable";
import { defineDoc } from "@earendil-works/pi-durable";

export type Child = {
  readonly id: string;
  readonly name: string;
  readonly conversationId: ConversationId;
  /** The reporter of every message sent to the child, oldest first. */
  readonly reporters: TaskId<string | null>[];
  /** Answers already reported: several messages can end in one answer, reported once. */
  readonly reported: EntryId[];
};

// The background children of one conversation, in spawn order.
export const Subagents = defineDoc<{ children: Child[] }>({
  kind: "tentacles.subagents",
  version: 1,
  scope: "conversation",
  history: "latest",
  fork: "initial",
  initial: () => ({ children: [] }),
  checkpointWhen: () => false,
});
