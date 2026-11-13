import type { Message } from "@earendil-works/pi-ai";
import { AssistantEntry, type EntryId, type Tx } from "@earendil-works/pi-durable";

const textOf = (message: Message | undefined) =>
  message?.role === "assistant"
    ? message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("")
    : "";

export const answerOf = async (tx: Pick<Tx, "entry">, answer: EntryId) =>
  textOf((await tx.entry(AssistantEntry, answer))?.model?.[0]);
