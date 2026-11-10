import * as Schema from "effect/Schema";

// A tool call's arguments stay unknown here: core's mapping of pi-durable's
// entries is the one place they are parsed.
export const Entry = Schema.Union([
  Schema.TaggedStruct("prompt", { text: Schema.String }),
  Schema.TaggedStruct("text", { text: Schema.String }),
  Schema.TaggedStruct("toolCall", {
    toolCallId: Schema.String,
    name: Schema.String,
    arguments: Schema.Unknown,
  }),
  Schema.TaggedStruct("toolResult", {
    toolCallId: Schema.String,
    output: Schema.String,
    isError: Schema.Boolean,
  }),
  Schema.TaggedStruct("subagentResult", { text: Schema.String }),
]).pipe(Schema.toTaggedUnion("_tag"));

export type Entry = typeof Entry.Type;
