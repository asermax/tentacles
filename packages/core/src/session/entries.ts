import type { Message, TextContent } from "@earendil-works/pi-ai";
import type { EntryRecord } from "@earendil-works/pi-durable";
import { Entry } from "@tentacles/worker-api/entries";
import * as Predicate from "effect/Predicate";

import { isForegroundAnswer } from "../tools/subagent.ts";
import { subagentReportKind, ToolNames } from "../tools/tool-names.ts";

type Part = { readonly type: string; readonly text?: string };

const textOf = (content: string | readonly Part[]) =>
  Predicate.isString(content) ? content : content.map((part) => part.text ?? "").join("");

const isText = (part: Part): part is TextContent => part.type === "text";

const fromMessage = (kind: string, message: Message): Entry[] => {
  switch (message.role) {
    case "user":
      return kind === subagentReportKind
        ? [Entry.cases.subagentResult.make({ text: textOf(message.content) })]
        : [Entry.cases.prompt.make({ text: textOf(message.content) })];
    case "assistant": {
      const text = textOf(message.content.filter(isText));

      const calls = message.content.flatMap((part) =>
        part.type === "toolCall"
          ? [
              Entry.cases.toolCall.make({
                toolCallId: part.id,
                name: part.name,
                arguments: part.arguments,
              }),
            ]
          : [],
      );

      return text === "" ? calls : [Entry.cases.text.make({ text }), ...calls];
    }

    case "toolResult":
      return message.toolName === ToolNames.subagent && isForegroundAnswer(message.details)
        ? [Entry.cases.subagentResult.make({ text: textOf(message.content) })]
        : [
            Entry.cases.toolResult.make({
              toolCallId: message.toolCallId,
              output: textOf(message.content),
              isError: message.isError,
            }),
          ];
    case "system":
      return [];
    default: {
      const exhaustive: never = message;

      return exhaustive;
    }
  }
};

/** The Worker API's entries for one pi-durable entry of the root conversation, in order. */
export const toEntries = (entry: EntryRecord): Entry[] =>
  (entry.model ?? []).flatMap((message) => fromMessage(entry.kind, message));
