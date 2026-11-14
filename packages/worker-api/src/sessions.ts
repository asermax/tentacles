import * as Effect from "effect/Effect";
import * as Record from "effect/Record";
import * as Schema from "effect/Schema";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

import { archiveKinds } from "./archive-kinds";
import { Entry } from "./entries";
import { InvalidArchive, QuestionNotWaiting, SessionNotFound } from "./errors";
import { QuestionId, SessionId } from "./ids";
import { ApiKey } from "./middleware";
import { Parent } from "./parent";
import { SessionListing, SessionState } from "./session-state";
import { Settings } from "./settings";

export const PromptModes = {
  followUp: "followUp",
  steer: "steer",
} as const;

export const PromptMode = Schema.Enum(PromptModes);

export type PromptMode = typeof PromptMode.Type;

export const maxArchiveBytes = 5 * 1024 * 1024;

const Archive = Schema.Uint8Array.check(Schema.isMaxLength(maxArchiveBytes));

export const CreateSession = Schema.Struct({
  name: Schema.String,
  parent: Parent,
  settings: Settings,
  prompt: Schema.String,
  ...Record.map(archiveKinds, () => Schema.optionalKey(Archive)),
});

export type CreateSession = typeof CreateSession.Type;

// A steer queues while a question waits.
export const Prompt = Schema.Struct({
  text: Schema.String,
  mode: PromptMode,
});

export type Prompt = typeof Prompt.Type;

export const Answer = Schema.Struct({
  questionId: QuestionId,
  text: Schema.String,
});

export type Answer = typeof Answer.Type;

const sessionParams = { sessionId: SessionId };

export const MessageCount = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

export class SessionsGroup extends HttpApiGroup.make("sessions")
  .add(
    HttpApiEndpoint.post("create", "/sessions", {
      payload: CreateSession,
      success: Schema.Struct({ sessionId: SessionId }),
      error: InvalidArchive,
    }),
    HttpApiEndpoint.post("prompt", "/sessions/:sessionId/prompt", {
      params: sessionParams,
      payload: Prompt,
      success: HttpApiSchema.NoContent,
      error: SessionNotFound,
    }),
    HttpApiEndpoint.post("answer", "/sessions/:sessionId/answer", {
      params: sessionParams,
      payload: Answer,
      success: HttpApiSchema.NoContent,
      error: [SessionNotFound, QuestionNotWaiting],
    }),
    HttpApiEndpoint.post("close", "/sessions/:sessionId/close", {
      params: sessionParams,
      success: HttpApiSchema.NoContent,
      error: SessionNotFound,
    }),
    HttpApiEndpoint.get("messages", "/sessions/:sessionId/messages", {
      params: sessionParams,
      query: { count: MessageCount.pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))) },
      success: Schema.Array(Entry),
      error: SessionNotFound,
    }),
    HttpApiEndpoint.get("status", "/sessions/:sessionId/status", {
      params: sessionParams,
      success: SessionState,
      error: SessionNotFound,
    }),
    HttpApiEndpoint.get("list", "/sessions", {
      query: Parent.fields,
      success: Schema.Array(SessionListing),
    }),
    // HttpApiSchema.Upgrade rejects websocket, so the socket declares its 101 as
    // an empty success and the client opens the socket on the endpoint's URL.
    HttpApiEndpoint.get("socket", "/sessions/:sessionId/socket", {
      params: sessionParams,
      success: HttpApiSchema.Empty(101),
      error: SessionNotFound,
    }),
  )
  .middleware(ApiKey) {}
