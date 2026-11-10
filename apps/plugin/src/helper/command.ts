import type { TentaclesError } from "@tentacles/worker-api/errors";
import { SessionId } from "@tentacles/worker-api/ids";
import { Parent } from "@tentacles/worker-api/parent";
import { Answer, MessageCount, Prompt } from "@tentacles/worker-api/sessions";
import type * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Schema from "effect/Schema";
import type * as HttpClient from "effect/http/HttpClient";
import type * as HttpClientError from "effect/http/HttpClientError";

import { Failure, HelperError, Success, type CommandResult } from "../core/helper-output.ts";
import { SpawnRequest } from "../core/spawn-request.ts";
import type { EndpointToolEntry } from "../core/tool-table.ts";
import { TentaclesClient, TentaclesClientLive } from "./client.ts";
import { SettingsDefaults } from "./config.ts";

const sessionFields = { sessionId: SessionId };

const PromptRequest = Schema.Struct({ ...sessionFields, ...Prompt.fields });

const AnswerRequest = Schema.Struct({ ...sessionFields, ...Answer.fields });

const SessionRequest = Schema.Struct(sessionFields);

const MessagesRequest = Schema.Struct({
  ...sessionFields,
  count: Schema.optionalKey(MessageCount),
});

const ListRequest = Schema.Struct({ parent: Parent });

const decodeArguments = <S extends Schema.ConstraintDecoder<unknown>>(schema: S, json: string) =>
  Schema.decodeEffect(Schema.fromJsonString(schema))(json);

type CommandError =
  | TentaclesError
  | HttpClientError.HttpClientError
  | Schema.SchemaError
  | Config.ConfigError;

type Command = (
  json: string,
) => Effect.Effect<unknown, CommandError, TentaclesClient | HttpClient.HttpClient>;

/** One endpoint call per tool: the arguments split into the endpoint's path params and payload or query. */
const commands: Record<EndpointToolEntry["name"], Command> = {
  spawn: (json: string) =>
    Effect.gen(function* () {
      const request = yield* decodeArguments(SpawnRequest, json);
      const defaults = yield* SettingsDefaults;
      const client = yield* TentaclesClient;

      return yield* client.sessions.create({
        payload: {
          name: request.name,
          parent: request.parent,
          prompt: request.prompt,
          settings: { ...defaults, repository: null, ...request.settings },
        },
      });
    }),
  prompt: (json: string) =>
    Effect.gen(function* () {
      const { sessionId, ...payload } = yield* decodeArguments(PromptRequest, json);
      const client = yield* TentaclesClient;

      return yield* client.sessions.prompt({ params: { sessionId }, payload });
    }),
  answer: (json: string) =>
    Effect.gen(function* () {
      const { sessionId, ...payload } = yield* decodeArguments(AnswerRequest, json);
      const client = yield* TentaclesClient;

      return yield* client.sessions.answer({ params: { sessionId }, payload });
    }),
  close: (json: string) =>
    Effect.gen(function* () {
      const params = yield* decodeArguments(SessionRequest, json);
      const client = yield* TentaclesClient;

      return yield* client.sessions.close({ params });
    }),
  messages: (json: string) =>
    Effect.gen(function* () {
      const { sessionId, count = 1 } = yield* decodeArguments(MessagesRequest, json);
      const client = yield* TentaclesClient;

      return yield* client.sessions.messages({ params: { sessionId }, query: { count } });
    }),
  list: (json: string) =>
    Effect.gen(function* () {
      const { parent } = yield* decodeArguments(ListRequest, json);
      const client = yield* TentaclesClient;

      return yield* client.sessions.list({ query: parent });
    }),
};

export type CommandName = EndpointToolEntry["name"];

export const isCommandName = (name: string): name is CommandName => Object.hasOwn(commands, name);

const describeHttpError = (error: HttpClientError.HttpClientError) => {
  const worker = new URL(error.request.url).origin;

  return error.response == null
    ? `The Worker did not answer at TENTACLES_URL (${worker}): ${error.message}`
    : `The Worker at TENTACLES_URL (${worker}) answered with status ${error.response.status}.`;
};

/** Runs one command and turns every outcome into a command result: the Worker's errors as Failure, anything else as HelperError. */
export const runCommand = (
  name: CommandName,
  json: string,
): Effect.Effect<CommandResult, never, HttpClient.HttpClient> =>
  commands[name](json).pipe(
    // A NoContent success is void; null keeps the result key in the JSON line.
    Effect.map((result) => Success.make({ result: result ?? null })),
    Effect.provide(TentaclesClientLive),
    Effect.catch((error) =>
      Effect.succeed(
        Match.value(error).pipe(
          Match.tags({
            SessionNotFound: (tentaclesError) => Failure.make({ error: tentaclesError }),
            QuestionNotWaiting: (tentaclesError) => Failure.make({ error: tentaclesError }),
            Unauthorized: (tentaclesError) => Failure.make({ error: tentaclesError }),
            HttpClientError: (httpError) =>
              HelperError.make({ message: describeHttpError(httpError) }),
            ConfigError: (configError) =>
              HelperError.make({
                message: `A variable is missing or not valid: ${configError.message}`,
              }),
            SchemaError: (schemaError) =>
              HelperError.make({
                message: `The arguments or the Worker's answer did not match: ${schemaError.message}`,
              }),
          }),
          Match.exhaustive,
        ),
      ),
    ),
  );
