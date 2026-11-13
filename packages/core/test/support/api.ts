import { RegistryStore } from "@tentacles/contracts/registry-store";
import { SessionHost } from "@tentacles/contracts/session-host";
import { TentaclesApi } from "@tentacles/worker-api/api";
import { ApiKey } from "@tentacles/worker-api/middleware";
import type { CreateSession } from "@tentacles/worker-api/sessions";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import { HttpApiBuilder } from "effect/http-api";
import * as Layer from "effect/Layer";

import { SessionsHandlersLive } from "../../src";

/**
 * SessionsHandlersLive served in-process over the world's SessionHost and
 * RegistryStore; the provider's API key check is left out.
 */
export const serveApi = Effect.gen(function* () {
  const context = yield* Effect.context<SessionHost | RegistryStore>();

  const app = HttpApiBuilder.layer(TentaclesApi).pipe(
    Layer.provide(SessionsHandlersLive),
    Layer.provide(Layer.succeed(ApiKey, ApiKey.of({ bearer: (effect) => effect }))),
    Layer.provide(Layer.succeedContext(context)),
    Layer.provide(HttpServer.layerServices),
  );

  const { handler } = yield* Effect.acquireRelease(
    Effect.sync(() => HttpRouter.toWebHandler(app, { disableLogger: true })),
    (served) => Effect.promise(() => served.dispose()),
  );

  return (path: string, init?: RequestInit) =>
    Effect.promise(() =>
      handler(
        new Request(`http://tentacles.test/api${path}`, {
          ...init,
          headers: { authorization: "Bearer test", "content-type": "application/json" },
        }),
      ),
    );
});

export const post = (json: string): RequestInit => ({ method: "POST", body: json });

const base64 = (archive: Uint8Array | undefined) =>
  archive == null ? undefined : Buffer.from(archive).toString("base64");

/** A create request as the Worker receives it: the archives are base64 strings. */
export const createBody = (request: CreateSession) =>
  JSON.stringify({ ...request, skills: base64(request.skills), agents: base64(request.agents) });
