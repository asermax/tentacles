import type { AssistantMessageEvent } from "@earendil-works/pi-ai";
import * as Schema from "effect/Schema";

// Only what the provider branches on: an error event carries the call's error text, and every other
// event is forwarded as it came.
const EventLineFields = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("error"),
    error: Schema.Struct({ errorMessage: Schema.optionalKey(Schema.String) }),
  }),
  Schema.Struct({
    type: Schema.String.check(Schema.makeFilter((type) => type !== "error")),
  }),
]);

const hasEventLineFields = Schema.is(EventLineFields);

// The relay writes pi-ai's own events, so the rest of an event is pi-ai's shape on both ends. The
// decoded value is the parsed event itself, not a copy that kept only the checked fields.
const RelayEvent = Schema.declare((candidate: unknown): candidate is AssistantMessageEvent =>
  hasEventLineFields(candidate),
);

/** The event an event line carries, or none when the line is not JSON or lacks the fields the provider reads. */
export const decodeEventLine = Schema.decodeUnknownOption(Schema.fromJsonString(RelayEvent));
