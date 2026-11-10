import * as Cloudflare from "@alchemy.run/cloudflare";
import { Scheduler } from "@tentacles/contracts/scheduler";
import { cleanup, previewHandler, SessionsHandlersLive } from "@tentacles/core";
import { TentaclesApi } from "@tentacles/worker-api/api";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import { HttpApiBuilder } from "effect/http-api";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { apiKeyLayer } from "./api-key.ts";
import { cdpRelay } from "./browser.ts";
import { codemodeSandboxClass, codemodeWorkerName } from "./codemode-sandbox.ts";
import { egress } from "./egress.ts";
import { apiHost, zone } from "./hosts.ts";
import { isPreviewHost, previewRoute, previewTokenOf } from "./preview-router.ts";
import { RegistryObject, RegistryObjectLive, registryStoreLayer } from "./registry-object.ts";
import { cloudflareScheduler } from "./scheduler.ts";
import { SessionObject, SessionObjectLive, sessionHostLayer } from "./session-object.ts";

const cdpPath = /^\/cdp\/([^/]+)$/;

const respond = (response: Response) =>
  HttpServerResponse.raw(response, { status: response.status });

const notFound = () => HttpServerResponse.text("Not found", { status: 404 });

/**
 * The tentacles Worker. Its routes run in a fixed order: a preview host, then the egress hosts the
 * containers reach through the loopback (which carry no API key), then the CDP relay, and only
 * then the API behind the key. Effect's request URL holds only the path, so the host comes from
 * the Web request.
 */
export default class TentaclesWorker extends Cloudflare.Worker<TentaclesWorker>()(
  "TentaclesWorker",
  {
    name: "tentacles",
    main: import.meta.url,
    observability: { enabled: true },
    domain: apiHost,
    routes: [{ pattern: previewRoute, zoneName: zone }],
    // The codemode Worker hosts the class, so scripts run off the session objects' threads.
    env: {
      [codemodeSandboxClass]: Cloudflare.DurableObject(codemodeSandboxClass, {
        scriptName: codemodeWorkerName,
      }),
    },
    build: {
      input: {
        // pi-env's client spawns its daemon with node:child_process, which workerd stubs.
        resolve: {
          alias: {
            "node:child_process": `${import.meta.dirname}/spawn-shim.ts`,
          },
        },
      },
    },
  },
  Effect.gen(function* () {
    const sessions = yield* SessionObject;
    const registries = yield* RegistryObject;
    const browser = yield* Cloudflare.Browser("BROWSER");
    const apiKey = yield* Config.Redacted("TENTACLES_API_KEY");
    const cdpSecret = yield* Config.Redacted("TENTACLES_CDP_SECRET");
    const egressRoute = yield* egress(sessions);
    const scheduler = yield* cloudflareScheduler;

    const contracts = Layer.mergeAll(sessionHostLayer(sessions), registryStoreLayer(registries));

    yield* Effect.flatMap(Effect.service(Scheduler), (jobs) =>
      jobs.daily(cleanup.pipe(Effect.provide(contracts))),
    ).pipe(Effect.provide(scheduler));

    const api = HttpApiBuilder.layer(TentaclesApi).pipe(
      Layer.provide(SessionsHandlersLive),
      Layer.provide(apiKeyLayer(apiKey)),
      Layer.provide(contracts),
      Layer.provide(HttpServer.layerServices),
    );

    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest.pipe(
          Effect.flatMap(HttpServerRequest.toWeb),
          Effect.orDie,
        );

        const url = new URL(request.url);

        if (isPreviewHost(url.hostname)) {
          return yield* Option.match(previewTokenOf(url.hostname), {
            onNone: () => Effect.succeed(notFound()),
            onSome: (token) =>
              previewHandler(token, request).pipe(Effect.map(respond), Effect.provide(contracts)),
          });
        }

        const egressResponse = egressRoute(request);

        if (Option.isSome(egressResponse)) {
          return respond(yield* egressResponse.value);
        }

        const cdp = cdpPath.exec(url.pathname);

        if (cdp?.[1] != null) {
          return respond(yield* cdpRelay(yield* browser.raw, cdpSecret)(cdp[1]));
        }

        if (url.pathname.startsWith("/api/")) {
          return yield* Effect.flatten(HttpRouter.toHttpEffect(api));
        }

        return notFound();
      }),
    };
  }).pipe(
    Effect.provide(
      SessionObjectLive.pipe(
        Layer.provideMerge(RegistryObjectLive),
        Layer.merge(Cloudflare.Workers.CronEventSourceLive),
        Layer.merge(Cloudflare.Workers.BrowserBinding),
      ),
    ),
  ),
) {}
