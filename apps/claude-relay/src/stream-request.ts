import type { CacheRetention, ThinkingLevel } from "@earendil-works/pi-ai";
import * as Schema from "effect/Schema";

const thinkingLevels = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const satisfies ReadonlyArray<ThinkingLevel>;

const cacheRetentions = ["none", "short", "long"] as const satisfies ReadonlyArray<CacheRetention>;

/**
 * The body of POST /stream: one model call from the relay provider, which sends the transcript pi-ai
 * handed it. The messages stay opaque here; pi-claude-code reads them when it builds the CLI's frames.
 */
export const StreamRequest = Schema.Struct({
  modelId: Schema.String,
  context: Schema.Struct({
    messages: Schema.Array(Schema.Unknown),
  }),
  options: Schema.Struct({
    sessionId: Schema.optionalKey(Schema.String),
    reasoning: Schema.optionalKey(Schema.Literals(thinkingLevels)),
    maxTokens: Schema.optionalKey(Schema.Int),
    cacheRetention: Schema.optionalKey(Schema.Literals(cacheRetentions)),
  }),
});

export type StreamRequest = typeof StreamRequest.Type;

export const decodeStreamRequest = Schema.decodeUnknownOption(Schema.fromJsonString(StreamRequest));
