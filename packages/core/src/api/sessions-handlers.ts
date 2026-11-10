import { RegistryStore } from "@tentacles/contracts/registry-store";
import { SessionHost } from "@tentacles/contracts/session-host";
import { TentaclesApi } from "@tentacles/worker-api/api";
import { SessionId } from "@tentacles/worker-api/ids";
import { SecureRandom } from "effect/crypto";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import { HttpApiBuilder } from "effect/http-api";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

const decodeSessionId = Schema.decodeUnknownEffect(SessionId);

/** The sessions group of TentaclesApi: list reads the registry, the rest reach the session. */
export const SessionsHandlersLive = HttpApiBuilder.group(TentaclesApi, "sessions", (handlers) =>
  Effect.gen(function* () {
    const host = yield* SessionHost;
    const registry = yield* RegistryStore;
    const random = yield* SecureRandom.SecureRandom;

    return (
      handlers
        .handle("create", ({ payload }) =>
          Effect.gen(function* () {
            const sessionId = yield* random
              .uuidV4()
              .pipe(Effect.flatMap(decodeSessionId), Effect.orDie);

            yield* host.create(sessionId, payload);

            return { sessionId };
          }),
        )
        .handle("prompt", ({ params, payload }) => host.prompt(params.sessionId, payload))
        .handle("answer", ({ params, payload }) => host.answer(params.sessionId, payload))
        .handle("close", ({ params }) => host.close(params.sessionId))
        .handle("messages", ({ params, query }) => host.messages(params.sessionId, query.count))
        .handle("status", ({ params }) => host.status(params.sessionId))
        .handle("list", ({ query }) => registry.list(query))
        // The session's own upgrade response goes out untouched: on a platform it
        // carries the socket itself.
        .handle("socket", ({ params, request }) =>
          HttpServerRequest.toWeb(request).pipe(
            Effect.orDie,
            Effect.flatMap((webRequest) => host.connect(params.sessionId, webRequest)),
            Effect.map((response) => HttpServerResponse.raw(response, { status: response.status })),
          ),
        )
    );
  }),
).pipe(Layer.provide(SecureRandom.layerWebCrypto));
