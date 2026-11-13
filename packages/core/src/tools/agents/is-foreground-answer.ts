import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

/** What a foreground run's result carries, so the transcript tells it from the other actions. */
const ForegroundDetails = Schema.Struct({ subagentConversation: Schema.Finite });

const decodeForegroundDetails = Schema.decodeUnknownOption(ForegroundDetails);

/** Whether a subagent tool result is a foreground child's answer. */
export const isForegroundAnswer = (details: Schema.Json | undefined) =>
  Option.isSome(decodeForegroundDetails(details));
