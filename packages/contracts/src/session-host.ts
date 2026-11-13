import type { Entry } from "@tentacles/worker-api/entries";
import type {
  InvalidArchive,
  QuestionNotWaiting,
  SessionNotFound,
} from "@tentacles/worker-api/errors";
import type { SessionId } from "@tentacles/worker-api/ids";
import type { SessionState } from "@tentacles/worker-api/session-state";
import type { Answer, CreateSession, Prompt } from "@tentacles/worker-api/sessions";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

// Reaches one session by its id, wherever the setup hosts it, and calls the
// session operations core implements. connect answers the parent's socket
// upgrade, and the session sends its state on connect; preview forwards a
// request to a port of the session's workspace once core's preview handler has
// resolved the token.
export class SessionHost extends Context.Service<
  SessionHost,
  {
    readonly create: (
      sessionId: SessionId,
      request: CreateSession,
    ) => Effect.Effect<void, InvalidArchive>;
    readonly prompt: (
      sessionId: SessionId,
      request: Prompt,
    ) => Effect.Effect<void, SessionNotFound>;
    readonly answer: (
      sessionId: SessionId,
      request: Answer,
    ) => Effect.Effect<void, SessionNotFound | QuestionNotWaiting>;
    readonly close: (sessionId: SessionId) => Effect.Effect<void, SessionNotFound>;
    readonly messages: (
      sessionId: SessionId,
      count: number,
    ) => Effect.Effect<ReadonlyArray<Entry>, SessionNotFound>;
    readonly status: (sessionId: SessionId) => Effect.Effect<SessionState, SessionNotFound>;
    readonly connect: (
      sessionId: SessionId,
      request: Request,
    ) => Effect.Effect<Response, SessionNotFound>;
    readonly preview: (
      sessionId: SessionId,
      port: number,
      request: Request,
    ) => Effect.Effect<Response, SessionNotFound>;
    readonly delete: (sessionId: SessionId) => Effect.Effect<void>;
  }
>()("tentacles/SessionHost") {}
