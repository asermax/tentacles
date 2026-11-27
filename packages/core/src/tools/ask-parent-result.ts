import { lit, obj, str } from "@earendil-works/pi-schema";
import * as Schema from "effect/Schema";

/** What ask_parent returns: the parent's answer. */
export const AskParentResult = Schema.TaggedStruct("Answered", { answer: Schema.String });

export type AskParentResult = typeof AskParentResult.Type;

/** AskParentResult's encoded form as pi-durable validates the tool's structured output. */
export const askParentResultSchema = obj({ _tag: lit("Answered"), answer: str() });
