import type {
  AssistantMessage,
  AssistantMessageEvent,
  Model,
  SimpleStreamOptions,
  TranscriptContext,
} from "@earendil-works/pi-ai";
import {
  CLOUDFLARE_GATEWAY_BINDING_AUTH_SENTINEL,
  createAiBindingFetch,
  type AiBinding,
} from "@earendil-works/pi-ai/api/cloudflare-ai-binding";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { createModels, createProvider } from "@earendil-works/pi-ai/models";
import { ANTHROPIC_MODELS } from "@earendil-works/pi-ai/providers/anthropic.models";
import { CLOUDFLARE_AI_GATEWAY_MODELS } from "@earendil-works/pi-ai/providers/cloudflare-ai-gateway.models";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai/utils/event-stream";
import { ModelProviders } from "@tentacles/contracts/model-providers";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

/** The AI Gateway the gateway provider goes through, declared by the stack. */
export const gatewayId = "tentacles";

/** Provider ids a session's settings name. */
export const ProviderIds = {
  gateway: "cloudflare",
  claude: "claude",
} as const;

const workersAiPrefix = "workers-ai/";

const claudeModelIds = new Set([
  "claude-fable-5-2",
  "claude-opus-5-5",
  "claude-sonnet-5-5",
  "claude-haiku-5-5",
]);

const claudeApi = "claude-relay";

const shortId = (catalogId: string) => catalogId.slice(catalogId.lastIndexOf("/") + 1);

// Workers AI models through the gateway, named by the last part of their catalog id (glm-5.2 for
// workers-ai/@cf/zai-org/glm-5.2); the request still carries the catalog id the gateway expects.
const gatewayProvider = (ai: AiBinding) => {
  const base = openAICompletionsApi();
  const fetch = createAiBindingFetch(ai);
  const baseUrl = `https://workers-binding.ai/ai-gateway/gateways/${gatewayId}/compat`;

  const catalog = Object.values(CLOUDFLARE_AI_GATEWAY_MODELS).filter((model) =>
    model.id.startsWith(workersAiPrefix),
  );

  const catalogIds = new Map(catalog.map((model) => [shortId(model.id), model.id]));

  const upstream = <T extends { id: string }>(model: T): T => ({
    ...model,
    id: catalogIds.get(model.id) ?? model.id,
  });

  // The binding is authenticated in the account; the sentinel only satisfies the API's check for
  // an auth header, and the null drops the SDK's own so the gateway does not read it as a key.
  const withBinding = (options?: SimpleStreamOptions) => ({
    ...options,
    fetch,
    headers: {
      ...options?.headers,
      "cf-aig-authorization": `Bearer ${CLOUDFLARE_GATEWAY_BINDING_AUTH_SENTINEL}`,
      Authorization: null,
    },
  });

  return createProvider({
    id: ProviderIds.gateway,
    name: "Workers AI through AI Gateway",
    auth: {
      apiKey: {
        name: "AI binding",
        resolve: async () => ({
          auth: { apiKey: CLOUDFLARE_GATEWAY_BINDING_AUTH_SENTINEL },
          source: "AI binding",
        }),
      },
    },
    models: catalog.map((model) => ({
      ...model,
      id: shortId(model.id),
      provider: ProviderIds.gateway,
      baseUrl,
    })),
    api: {
      stream: (model, context, options) =>
        base.stream(upstream(model), context, withBinding(options)),
      streamSimple: (model, context, options) =>
        base.streamSimple(upstream(model), context, withBinding(options)),
    },
  });
};

const failed = (model: Model<string>, message: string): AssistantMessageEvent => {
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
    errorMessage: message,
    timestamp: Date.now(),
  };

  return { type: "error", reason: "error", error };
};

const relayLines = async function* (body: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  let buffered = "";

  for await (const chunk of body) {
    buffered += decoder.decode(chunk, { stream: true });

    const lines = buffered.split("\n");

    buffered = lines.pop() ?? "";

    yield* lines.filter((line) => line.length > 0);
  }

  if (buffered.length > 0) {
    yield buffered;
  }
};

// The Claude subscription through the relay in the shared Claude container: one POST per call,
// one pi-ai event per NDJSON line back. A broken stream becomes an error event.
const claudeProvider = (claude: () => Fetcher) => {
  const stream = (
    model: Model<string>,
    context: TranscriptContext,
    options?: SimpleStreamOptions,
  ) => {
    const events = createAssistantMessageEventStream();

    const relay = async () => {
      const response = await claude().fetch("http://claude/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          modelId: model.id,
          context,
          options: {
            sessionId: options?.sessionId,
            reasoning: options?.reasoning,
            maxTokens: options?.maxTokens,
            cacheRetention: options?.cacheRetention,
          },
        }),
        signal: options?.signal ?? null,
      });

      if (!response.ok || response.body == null) {
        throw new Error(`The Claude relay answered ${response.status}: ${await response.text()}`);
      }

      for await (const line of relayLines(response.body)) {
        // The relay is apps/claude-relay, which writes pi-ai's own AssistantMessageEvents one
        // per line, so the shape is pi-ai's on both ends and the line is not parsed again.
        const event: AssistantMessageEvent = JSON.parse(line);

        events.push(event);
      }
    };

    relay()
      .catch((error) =>
        events.push(failed(model, error instanceof Error ? error.message : String(error))),
      )
      .finally(() => events.end());

    return events;
  };

  return createProvider({
    id: ProviderIds.claude,
    name: "Claude through the Claude relay",
    auth: {
      apiKey: {
        name: "Claude relay",
        resolve: async () => ({ auth: { apiKey: "relay" }, source: "Claude relay" }),
      },
    },
    models: Object.values(ANTHROPIC_MODELS)
      .filter((model) => claudeModelIds.has(model.id))
      .map(({ compat: _compat, ...model }) => ({
        ...model,
        api: claudeApi,
        provider: ProviderIds.claude,
        baseUrl: "relay://claude",
      })),
    api: { stream, streamSimple: stream },
  });
};

/** Every model a session can name: Workers AI through the gateway, and Claude through the relay. */
export const modelProvidersLayer = (ai: AiBinding, claude: () => Fetcher) => {
  const models = createModels();

  models.setProvider(gatewayProvider(ai));
  models.setProvider(claudeProvider(claude));

  return Layer.succeed(ModelProviders, ModelProviders.of({ models: () => Effect.succeed(models) }));
};
