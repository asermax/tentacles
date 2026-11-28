import type { AssistantMessageEvent } from "@earendil-works/pi-ai";

/** Ends every event line; a reader splits the relay's stream on it. */
export const eventLineEnd = "\n";

/** One pi-ai event as the NDJSON line the relay writes and the provider reads. */
export const eventLine = (event: AssistantMessageEvent) =>
  `${JSON.stringify(event)}${eventLineEnd}`;
