import type {
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
import { failedEvent } from "@tentacles/relay-protocol/failed-event";
import { lostCallMessage } from "@tentacles/relay-protocol/lost-call";
import { StreamRequest } from "@tentacles/relay-protocol/stream-request";
import type { SessionId } from "@tentacles/worker-api/ids";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Struct from "effect/Struct";

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

// Workers AI models through the gateway, named by the last part of their catalog id (glm-5.3 for
// workers-ai/@cf/zai-org/glm-5.3); the request still carries the catalog id the gateway expects.
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

const relayLines = async function* (body: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  let buffered = "";

  for await (const chunk of body) {
    // Only the new text is searched, so a line arriving over many chunks is scanned once.
    const searchFrom = buffered.length;

    buffered += decoder.decode(chunk, { stream: true });

    for (
      let newline = buffered.indexOf("\n", searchFrom);
      newline >= 0;
      newline = buffered.indexOf("\n")
    ) {
      const line = buffered.slice(0, newline);

      buffered = buffered.slice(newline + 1);

      if (line.length > 0) {
        yield line;
      }
    }
  }

  if (buffered.length > 0) {
    yield buffered;
  }
};

// The Claude subscription through the relay in the shared Claude container: one POST per call,
// one pi-ai event per NDJSON line back. A call that fails ends in an error event, and a stream that
// ends with neither done nor error is a lost call, which pi-durable retries.
const claudeProvider = (claude: () => Fetcher, tentaclesSessionId: SessionId) => {
  const stream = (
    model: Model<string>,
    context: TranscriptContext,
    options?: SimpleStreamOptions,
  ) => {
    const events = createAssistantMessageEventStream();

    // The one place a failed call is pushed and logged, with the session and conversation the relay's
    // records carry, so both sides of the call can be matched.
    const failCall = (errorMessage: string) => {
      console.error(
        JSON.stringify({
          message: "A Claude call failed",
          session: tentaclesSessionId,
          conversation: options?.sessionId,
          errorMessage,
        }),
      );

      events.push(failedEvent(model, errorMessage));
    };

    const relay = async () => {
      const streamRequest: StreamRequest = {
        modelId: model.id,
        context: { messages: context.messages },
        options: Struct.pick(options ?? {}, Struct.keys(StreamRequest.fields.options.fields)),
        sender: { session: tentaclesSessionId },
      };

      const response = await claude().fetch("http://claude/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(streamRequest),
        signal: options?.signal ?? null,
      });

      if (!response.ok || response.body == null) {
        throw new Error(`The Claude relay answered ${response.status}: ${await response.text()}`);
      }

      let hasEnded = false;

      for await (const line of relayLines(response.body)) {
        // The relay is apps/claude-relay, which writes pi-ai's own AssistantMessageEvents one
        // per line, so the shape is pi-ai's on both ends and the line is not parsed again.
        const event: AssistantMessageEvent = JSON.parse(line);

        if (event.type === "error") {
          failCall(event.error.errorMessage ?? "The Claude relay reported an error");
          hasEnded = true;
        } else {
          events.push(event);
          hasEnded ||= event.type === "done";
        }
      }

      if (!hasEnded) {
        throw new Error(lostCallMessage("the relay's stream ended without a result"));
      }
    };

    // The run aborts the signal once it has what it needs, such as the done event while the relay's
    // stream is still open, and the read that fails because of it is not a failed call.
    relay()
      .catch((error) => {
        if (options?.signal?.aborted !== true) {
          failCall(error instanceof Error ? error.message : String(error));
        }
      })
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

/**
 * Every model a session can name: Workers AI through the gateway, and Claude through the relay, which
 * is told which tentacles session each call comes from.
 */
export const modelProvidersLayer = (
  ai: AiBinding,
  claude: () => Fetcher,
  tentaclesSessionId: SessionId,
) => {
  const models = createModels();

  models.setProvider(gatewayProvider(ai));
  models.setProvider(claudeProvider(claude, tentaclesSessionId));

  return Layer.succeed(ModelProviders, ModelProviders.of({ models: () => Effect.succeed(models) }));
};
