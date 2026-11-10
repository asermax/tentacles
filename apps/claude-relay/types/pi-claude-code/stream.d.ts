import type {
  AssistantMessageEventStream,
  SimpleStreamOptions,
  TranscriptContext,
} from "@earendil-works/pi-ai";

import type { ClaudeCodeModel } from "./model-catalog.d.ts";

export declare const streamClaudeCode: (
  model: ClaudeCodeModel,
  context: TranscriptContext,
  options?: SimpleStreamOptions,
) => AssistantMessageEventStream;
