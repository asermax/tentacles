import { createServer } from "node:http";

import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { TentaclesApi } from "@tentacles/worker-api/api";
import type { Entry } from "@tentacles/worker-api/entries";
import {
  type InvalidArchive,
  QuestionNotWaiting,
  SessionNotFound,
  Unauthorized,
} from "@tentacles/worker-api/errors";
import type { SessionId } from "@tentacles/worker-api/ids";
import type { Parent } from "@tentacles/worker-api/parent";
import type { Answer, CreateSession, Prompt } from "@tentacles/worker-api/sessions";
import { ApiKey } from "@tentacles/worker-api/middleware";
import { SessionState, type SessionRef } from "@tentacles/worker-api/session-state";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import { HttpApiBuilder } from "effect/http-api";

import { details } from "./values.ts";

export const stubApiKey = "stub-api-key";

/** One state the session's socket sends, after a pause. */
export interface ScriptedState {
  readonly state: SessionState;
  readonly afterMs?: number;
}

export interface ScriptedSession {
  readonly states: ReadonlyArray<ScriptedState>;
  readonly entries: ReadonlyArray<Entry>;
}

/** What the stub answers; `createFailure` makes create answer with that error instead of the created id. */
export interface StubScript {
  readonly createdId?: SessionId;
  readonly createFailure?: InvalidArchive;
  readonly sessions?: ReadonlyMap<SessionId, ScriptedSession>;
  readonly listed?: ReadonlyArray<SessionRef>;
  readonly isQuestionWaiting?: boolean;
  /** Every endpoint answers 500. */
  readonly isFailing?: boolean;
}

/** One request the stub received, after the API decoded it. */
export interface ReceivedRequest {
  readonly endpoint: string;
  readonly sessionId?: SessionId;
  readonly payload?: CreateSession | Prompt | Answer;
  readonly query?: { readonly count: number } | Parent;
}

/** A running stub; `creates` holds the create payloads received, archives included. */
export interface StubWorker {
  readonly url: string;
  readonly requests: Array<ReceivedRequest>;
  readonly creates: Array<CreateSession>;
  readonly stop: () => Promise<void>;
}

const encodeState = Schema.encodeSync(Schema.fromJsonString(SessionState));

const stubLayer = (
  script: StubScript,
  requests: Array<ReceivedRequest>,
  creates: Array<CreateSession>,
) => {
  const sessionOf = (sessionId: SessionId): Effect.Effect<ScriptedSession, SessionNotFound> => {
    const session = script.sessions?.get(sessionId);

    return session == null
      ? Effect.fail(new SessionNotFound({ sessionId }))
      : Effect.succeed(session);
  };

  const answering = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    script.isFailing ? Effect.die("the stub fails") : effect;

  const handlers = HttpApiBuilder.group(TentaclesApi, "sessions", (group) =>
    group
      .handle("create", ({ payload }) => {
        requests.push({ endpoint: "create", payload: payload });
        creates.push(payload);

        if (script.createFailure != null) {
          return answering(Effect.fail(script.createFailure));
        }

        return answering(
          script.createdId == null
            ? Effect.die("the script names no created session")
            : Effect.succeed({ sessionId: script.createdId }),
        );
      })
      .handle("prompt", ({ params, payload }) => {
        requests.push({ endpoint: "prompt", sessionId: params.sessionId, payload: payload });

        return answering(sessionOf(params.sessionId).pipe(Effect.asVoid));
      })
      .handle("answer", ({ params, payload }) => {
        requests.push({ endpoint: "answer", sessionId: params.sessionId, payload: payload });

        return answering(
          sessionOf(params.sessionId).pipe(
            Effect.flatMap(() =>
              script.isQuestionWaiting === false
                ? Effect.fail(new QuestionNotWaiting({ questionId: payload.questionId }))
                : Effect.void,
            ),
          ),
        );
      })
      .handle("close", ({ params }) => {
        requests.push({ endpoint: "close", sessionId: params.sessionId });

        return answering(sessionOf(params.sessionId).pipe(Effect.asVoid));
      })
      .handle("messages", ({ params, query }) => {
        requests.push({ endpoint: "messages", sessionId: params.sessionId, query: query });

        return answering(
          sessionOf(params.sessionId).pipe(
            Effect.map((session) => session.entries.slice(-query.count)),
          ),
        );
      })
      .handle("status", ({ params }) => {
        requests.push({ endpoint: "status", sessionId: params.sessionId });

        return answering(
          sessionOf(params.sessionId).pipe(
            Effect.map(
              (session) => session.states.at(-1)?.state ?? SessionState.cases.running.make(details),
            ),
          ),
        );
      })
      .handle("list", ({ query }) => {
        requests.push({ endpoint: "list", query: query });

        return answering(
          Effect.succeed((script.listed ?? []).map((session) => ({ ...session, ...details }))),
        );
      })
      .handle("socket", ({ params, request }) => {
        requests.push({ endpoint: "socket", sessionId: params.sessionId });

        return answering(
          Effect.gen(function* () {
            const session = yield* sessionOf(params.sessionId);
            const socket = yield* request.upgrade.pipe(Effect.orDie);
            // The 101 goes out once the reader is acquired.
            yield* socket.reader.pipe(Effect.orDie);

            const write = yield* socket.writer;

            for (const { state, afterMs = 0 } of session.states) {
              yield* Effect.sleep(afterMs);
              yield* write.write(encodeState(state)).pipe(Effect.orDie);
            }

            return yield* Effect.never;
          }).pipe(Effect.scoped),
        );
      }),
  );

  const apiKey = Layer.succeed(ApiKey)({
    bearer: (httpEffect, { credential }) =>
      Redacted.value(credential) === stubApiKey ? httpEffect : Effect.fail(new Unauthorized()),
  });

  return HttpRouter.serve(HttpApiBuilder.layer(TentaclesApi), {
    disableLogger: true,
    disableListenLog: true,
  }).pipe(
    Layer.provide(handlers),
    Layer.provide(apiKey),
    Layer.provideMerge(NodeHttpServer.layer(createServer, { port: 0 })),
  );
};

/** A Worker served from TentaclesApi on a free local port, answering from the script and recording each request. */
export const startStubWorker = async (script: StubScript = {}): Promise<StubWorker> => {
  const requests: Array<ReceivedRequest> = [];
  const creates: Array<CreateSession> = [];
  const scope = await Effect.runPromise(Scope.make());

  const context = await Effect.runPromise(
    Layer.buildWithScope(stubLayer(script, requests, creates), scope),
  );

  const address = Context.get(context, HttpServer.HttpServer).address;
  const port = "port" in address ? address.port : 0;

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    creates,
    stop: () => Effect.runPromise(Scope.close(scope, Exit.void)),
  };
};
