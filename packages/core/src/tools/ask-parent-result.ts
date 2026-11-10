import { lit, obj, str, union } from "@earendil-works/pi-schema";
import * as Schema from "effect/Schema";

/** What ask_parent returns: the parent's answer, or the repository's pending work. */
export const AskParentResult = Schema.Union([
  Schema.TaggedStruct("Answered", { answer: Schema.String }),
  Schema.TaggedStruct("PendingWork", { status: Schema.String }),
]).pipe(Schema.toTaggedUnion("_tag"));

export type AskParentResult = typeof AskParentResult.Type;

/** AskParentResult's encoded form as pi-durable validates the tool's structured output. */
export const askParentResultSchema = union([
  obj({ _tag: lit("Answered"), answer: str() }),
  obj({
    _tag: lit("PendingWork"),
    status: str({
      description:
        "git status --short of the managed repository, and the commits not pushed: commit and " +
        "push, drop the changes, or move them out of the repository, then ask again",
    }),
  }),
]);
