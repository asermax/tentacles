import * as Cloudflare from "@alchemy.run/cloudflare";
import { openDurableObjectSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/cloudflare";
import { ParentChannel } from "@tentacles/contracts/parent-channel";
import { SessionHost } from "@tentacles/contracts/session-host";
import { SessionStorage } from "@tentacles/contracts/session-storage";
import { WakeTimer } from "@tentacles/contracts/wake-timer";
import { Session } from "@tentacles/core";
import type { Entry } from "@tentacles/worker-api/entries";
import { InvalidArchive, QuestionNotWaiting, SessionNotFound } from "@tentacles/worker-api/errors";
import { SessionId } from "@tentacles/worker-api/ids";
import { SessionState } from "@tentacles/worker-api/session-state";
import type { Answer, CreateSession, Prompt } from "@tentacles/worker-api/sessions";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";

import { browserLayer } from "./browser.ts";
import { claudeObjectName, ClaudeObject } from "./claude-object.ts";
import { codemodeSandboxClass, codeSandboxLayer } from "./codemode-sandbox.ts";
import type { CodemodeSandbox } from "./codemode-worker.ts";
import { sendableCode } from "./close-code.ts";
import { loopback } from "./egress.ts";
import { modelProvidersLayer } from "./model-providers.ts";
import { CloudflarePreviewRouter } from "./preview-router.ts";
import { RegistryObject, registryStoreLayer } from "./registry-object.ts";
import {
  ContainerSettings,
  unsupportedSettings,
  WorkspaceContainer,
  workspaceLayer,
} from "./workspace.ts";

/** The session operations the object answers over RPC; connect and preview go through fetch. */
export interface SessionOperations {
  readonly create: (request: CreateSession) => Effect.Effect<void, InvalidArchive>;
  readonly prompt: (request: Prompt) => Effect.Effect<void, SessionNotFound>;
  readonly answer: (request: Answer) => Effect.Effect<void, SessionNotFound | QuestionNotWaiting>;
  readonly close: () => Effect.Effect<void, SessionNotFound>;
  readonly messages: (count: number) => Effect.Effect<ReadonlyArray<Entry>, SessionNotFound>;
  readonly status: () => Effect.Effect<SessionState, SessionNotFound>;
  readonly delete: () => Effect.Effect<void>;
  readonly workspaceNeeded: (isWorkPending: boolean) => Effect.Effect<boolean>;
}

/** One object per session, named by its id. */
export class SessionObject extends Cloudflare.DurableObject<SessionObject, SessionOperations>()(
  "SessionObject",
  { errors: [SessionNotFound, QuestionNotWaiting, InvalidArchive] },
) {}

// A request the Worker passes to the object through fetch carries what it is for in a header,
// and keeps its own URL, which the preview forwards to the workspace as it came.
const routeHeader = "x-tentacles-session-route";
const portHeader = "x-tentacles-preview-port";
const notFoundHeader = "x-tentacles-session-not-found";

const FetchRoutes = {
  connect: "connect",
  preview: "preview",
} as const;

const encodeState = (state: SessionState) =>
  Schema.encodeEffect(SessionState)(state).pipe(Effect.map(JSON.stringify), Effect.orDie);

const decodeContainerSettings = Schema.decodeUnknownEffect(ContainerSettings);

const notFound = () =>
  HttpServerResponse.text("Session not found", { status: 404, headers: { [notFoundHeader]: "1" } });

const objectDependencies = Effect.gen(function* () {
  yield* WorkspaceContainer;

  return {
    state: yield* Cloudflare.DurableObjectState,
    registries: yield* RegistryObject,
    claude: yield* ClaudeObject,
    ai: yield* Cloudflare.Workers.AI(),
    browser: yield* Cloudflare.Browser("BROWSER"),
    cdpSecret: yield* Config.Redacted("TENTACLES_CDP_SECRET").pipe(Effect.orDie),
    env: yield* Cloudflare.WorkerEnvironment,
  };
}).pipe(
  Effect.provide(Layer.mergeAll(Cloudflare.Workers.AIBinding, Cloudflare.Workers.BrowserBinding)),
);

export const SessionObjectLive = SessionObject.make(
  Effect.map(objectDependencies, ({ state, registries, claude, ai, browser, cdpSecret, env }) =>
    Effect.gen(function* () {
      const raw = state.raw;

      // Only the workspace needs the container, so the object starts without one, as it does in
      // Miniflare.
      const container = () => {
        if (raw.container == null) {
          throw new Error("The session object has no container");
        }

        return raw.container;
      };

      const sessionId = yield* Schema.decodeUnknownEffect(SessionId)(raw.id.name).pipe(
        Effect.orDie,
      );

      const storage = yield* Effect.promise(() => openDurableObjectSqliteStorage(raw.storage));
      const egress = yield* loopback(state, { sessionId });

      // Raw bindings for the Promise-based clients that pi-ai and pi-codemode bring.
      const claudeObjects: DurableObjectNamespace = env[claude.name];
      const codemodeSandboxes: DurableObjectNamespace<CodemodeSandbox> = env[codemodeSandboxClass];

      const contracts = Layer.mergeAll(
        Layer.succeed(
          SessionStorage,
          SessionStorage.of({ storage: () => Effect.succeed(storage) }),
        ),
        Layer.succeed(
          WakeTimer,
          WakeTimer.of({
            set: (at) => Effect.promise(() => raw.storage.setAlarm(at)),
            clear: () => Effect.promise(() => raw.storage.deleteAlarm()),
          }),
        ),
        Layer.succeed(
          ParentChannel,
          ParentChannel.of({
            send: (sessionState) =>
              Effect.gen(function* () {
                const text = yield* encodeState(sessionState);

                // A socket that is closing throws on send; the others still get the state.
                yield* Effect.forEach(raw.getWebSockets(), (socket) =>
                  Effect.try(() => socket.send(text)).pipe(Effect.ignore),
                );
              }),
          }),
        ),
        workspaceLayer({ sessionId, container, egress }),
        browserLayer(yield* browser.raw, cdpSecret, raw.storage),
        CloudflarePreviewRouter,
        registryStoreLayer(registries),
        modelProvidersLayer(yield* ai.raw, () => claudeObjects.getByName(claudeObjectName)),
        codeSandboxLayer(codemodeSandboxes, sessionId),
      );

      // The harness lives as long as the object's instance, so its scope is never closed.
      const handle = yield* Session.make(sessionId).pipe(
        Effect.provide(contracts),
        Scope.provide(Scope.makeUnsafe()),
      );

      return {
        create: (request: CreateSession) =>
          Effect.gen(function* () {
            yield* decodeContainerSettings(request.settings).pipe(
              Effect.mapError(() => new Error(unsupportedSettings(request.settings))),
              Effect.orDie,
            );
            yield* handle.create(request);
          }),

        prompt: (request: Prompt) => handle.prompt(request),
        answer: (request: Answer) => handle.answer(request),
        close: () => handle.close(),
        messages: (count: number) => handle.messages(count),
        status: () => handle.status(),
        // core stops the session; what the object stored is the provider's to remove.
        delete: () =>
          Effect.andThen(
            handle.delete(),
            Effect.promise(() => raw.storage.deleteAll()),
          ),
        workspaceNeeded: (isWorkPending: boolean) => handle.workspaceNeeded(isWorkPending),

        fetch: Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest.pipe(
            Effect.flatMap(HttpServerRequest.toWeb),
            Effect.orDie,
          );

          switch (request.headers.get(routeHeader)) {
            case FetchRoutes.connect: {
              const sessionState = yield* handle.status();
              const [response, socket] = yield* Cloudflare.upgrade();

              yield* socket.send(yield* encodeState(sessionState));

              return response;
            }

            case FetchRoutes.preview: {
              const headers = new Headers(request.headers);
              const port = Number(headers.get(portHeader));

              headers.delete(routeHeader);
              headers.delete(portHeader);

              const response = yield* handle.preview(port, new Request(request, { headers }));

              return HttpServerResponse.raw(response, { status: response.status });
            }

            default:
              return HttpServerResponse.text("Not found", { status: 404 });
          }
        }).pipe(Effect.catchTag("SessionNotFound", () => Effect.succeed(notFound()))),

        alarm: () => handle.wake(),

        webSocketClose: (socket: Cloudflare.WebSocket, code: number, reason: string) =>
          socket.close(sendableCode(code), reason),
      };
    }),
  ),
);

/** SessionHost for the Worker: each session is its object, reached by name. */
export const sessionHostLayer = (sessions: Cloudflare.DurableObject<SessionObject>) => {
  const session = (sessionId: SessionId) => sessions.getByName(sessionId);

  const throughFetch = (sessionId: SessionId, request: Request, headers: Record<string, string>) =>
    Effect.gen(function* () {
      const routed = new Request(request);

      for (const [name, value] of Object.entries(headers)) {
        routed.headers.set(name, value);
      }

      const response = yield* session(sessionId)
        .fetch(HttpServerRequest.fromWeb(routed))
        .pipe(Effect.map(HttpServerResponse.toWeb), Effect.orDie);

      if (response.headers.has(notFoundHeader)) {
        return yield* new SessionNotFound({ sessionId });
      }

      return response;
    });

  return Layer.succeed(
    SessionHost,
    SessionHost.of({
      create: (sessionId, request) => session(sessionId).create(request),
      prompt: (sessionId, request) => session(sessionId).prompt(request),
      answer: (sessionId, request) => session(sessionId).answer(request),
      close: (sessionId) => session(sessionId).close(),
      messages: (sessionId, count) => session(sessionId).messages(count),
      status: (sessionId) => session(sessionId).status(),
      delete: (sessionId) => session(sessionId).delete(),
      connect: (sessionId, request) =>
        throughFetch(sessionId, request, { [routeHeader]: FetchRoutes.connect }),
      preview: (sessionId, port, request) =>
        throughFetch(sessionId, request, {
          [routeHeader]: FetchRoutes.preview,
          [portHeader]: String(port),
        }),
    }),
  );
};
