import { TentaclesError } from "@tentacles/worker-api/errors";
import { SessionId } from "@tentacles/worker-api/ids";
import { Parent } from "@tentacles/worker-api/parent";
import { Answer, MessageCount, Prompt } from "@tentacles/worker-api/sessions";
import type * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Schema from "effect/Schema";
import type * as HttpClient from "effect/http/HttpClient";
import type * as HttpClientError from "effect/http/HttpClientError";

import { Failure, HelperError, Success, type CommandResult } from "../core/helper-output";
import { SpawnRequest } from "../core/spawn-request";
import type { EndpointToolEntry } from "../core/tool-table";
import { TentaclesClient, TentaclesClientLive } from "./client";
import { SettingsDefaults } from "./config";
import { readDefinitions, rejectionText, type Rejected } from "./definitions";

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
  | Rejected
  | HttpClientError.HttpClientError
  | Schema.SchemaError
  | Config.ConfigError;

type Command = (
  json: string,
) => Effect.Effect<unknown, CommandError, TentaclesClient | HttpClient.HttpClient>;

const withClient =
  <S extends Schema.ConstraintDecoder<unknown>>(
    schema: S,
    call: (
      client: TentaclesClient["Service"],
      request: S["Type"],
    ) => Effect.Effect<unknown, CommandError, HttpClient.HttpClient>,
  ): Command =>
  (json) =>
    Effect.gen(function* () {
      const request = yield* decodeArguments(schema, json);
      const client = yield* TentaclesClient;

      return yield* call(client, request);
    });

/** One endpoint call per tool: the arguments split into the endpoint's path params and payload or query. */
const commands: Record<EndpointToolEntry["name"], Command> = {
  spawn: (json: string) =>
    Effect.gen(function* () {
      const request = yield* decodeArguments(SpawnRequest, json);
      const defaults = yield* SettingsDefaults;
      const client = yield* TentaclesClient;

      const archives = yield* readDefinitions({
        skills: request.skills ?? [],
        agents: request.agents ?? [],
      });

      return yield* client.sessions.create({
        payload: {
          name: request.name,
          parent: request.parent,
          prompt: request.prompt,
          settings: { ...defaults, repository: null, ...request.settings },
          ...archives,
        },
      });
    }),
  prompt: withClient(PromptRequest, (client, { sessionId, ...payload }) =>
    client.sessions.prompt({ params: { sessionId }, payload }),
  ),
  answer: withClient(AnswerRequest, (client, { sessionId, ...payload }) =>
    client.sessions.answer({ params: { sessionId }, payload }),
  ),
  close: withClient(SessionRequest, (client, params) => client.sessions.close({ params })),
  messages: withClient(MessagesRequest, (client, { sessionId, count = 1 }) =>
    client.sessions.messages({ params: { sessionId }, query: { count } }),
  ),
  list: withClient(ListRequest, (client, { parent }) => client.sessions.list({ query: parent })),
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
          Match.when(Schema.is(TentaclesError), (tentaclesError) =>
            Failure.make({ error: tentaclesError }),
          ),
          Match.tags({
            Rejected: (rejected) => HelperError.make({ message: rejectionText(rejected) }),
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
