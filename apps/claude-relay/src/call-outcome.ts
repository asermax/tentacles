import * as Schema from "effect/Schema";

/** How a call ended. */
export const CallOutcome = Schema.Union([
  Schema.TaggedStruct("Done", {}),
  Schema.TaggedStruct("Failed", { errorMessage: Schema.String }),
  Schema.TaggedStruct("Lost", { errorMessage: Schema.String }),
  Schema.TaggedStruct("Aborted", {}),
  Schema.TaggedStruct("Stopped", {}),
]).pipe(Schema.toTaggedUnion("_tag"));

export type CallOutcome = typeof CallOutcome.Type;
