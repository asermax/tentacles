import type { AssistantMessage, AssistantMessageEvent, Model } from "@earendil-works/pi-ai";

export type FailedEventModel = Pick<Model<string>, "api" | "provider" | "id">;

/** The error event that ends a call as failed: an empty message carrying only the error text. */
export const failedEvent = (
  model: FailedEventModel,
  errorMessage: string,
): AssistantMessageEvent => {
  const error: AssistantMessage = {
    role: "assistant",
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "error",
    errorMessage,
    timestamp: Date.now(),
  };

  return { type: "error", reason: "error", error };
};
