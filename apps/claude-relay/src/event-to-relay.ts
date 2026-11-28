import type { AssistantMessageEvent } from "@earendil-works/pi-ai";

import { CallOutcome } from "./call-outcome";
import { outcomeOfFailure } from "./lost-call";

interface EventToRelay {
  /** What goes to the caller: the event, with a lost call's error message in the lost-call wording. */
  readonly eventToSend: AssistantMessageEvent;
  /** How the call ended, when this event ends it. */
  readonly outcome: CallOutcome | undefined;
}

/** What to send for one event of a call, and how it ended the call when it did. */
export const eventToRelay = (event: AssistantMessageEvent): EventToRelay => {
  if (event.type === "done") {
    return { eventToSend: event, outcome: CallOutcome.cases.Done.make({}) };
  }

  if (event.type !== "error") {
    return { eventToSend: event, outcome: undefined };
  }

  if (event.reason === "aborted") {
    return { eventToSend: event, outcome: CallOutcome.cases.Aborted.make({}) };
  }

  const outcome = outcomeOfFailure(event.error.errorMessage ?? "");

  return {
    eventToSend: { ...event, error: { ...event.error, errorMessage: outcome.errorMessage } },
    outcome,
  };
};
