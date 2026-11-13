import { Harnesses, type Harness } from "@tentacles/worker-api/parent";
import type { SessionsGroup } from "@tentacles/worker-api/sessions";
import * as Data from "effect/Data";
import type * as JsonSchema from "effect/JsonSchema";
import * as Schema from "effect/Schema";

import { endpointArguments } from "./endpoint-arguments.ts";
import { SpawnArguments } from "./spawn-request.ts";

export const ToolNames = {
  spawn: "spawn",
  prompt: "prompt",
  messages: "messages",
  wait: "wait",
  list: "list",
  close: "close",
  answer: "answer",
} as const;

export type ToolName = (typeof ToolNames)[keyof typeof ToolNames];

export type SessionsEndpoint = keyof typeof SessionsGroup.endpoints;

export type ToolEntry = Data.TaggedEnum<{
  Endpoint: {
    readonly name: Exclude<ToolName, typeof ToolNames.wait>;
    /** The text the model sees. */
    readonly description: string;
    readonly endpoint: SessionsEndpoint;
    readonly harnesses: ReadonlyArray<Harness>;
    readonly arguments: JsonSchema.JsonSchema;
  };
  WatchOnly: {
    readonly name: typeof ToolNames.wait;
    readonly description: string;
    readonly harnesses: ReadonlyArray<Harness>;
  };
}>;

export const ToolEntry = Data.taggedEnum<ToolEntry>();

export type EndpointToolEntry = Data.TaggedEnum.Value<ToolEntry, "Endpoint">;

const bothHarnesses = [Harnesses.pi, Harnesses.claude];

const spawnDocument = Schema.toJsonSchemaDocument(SpawnArguments);

/** The only list of tools: the helper's commands and both glues' registrations read it. */
export const ToolTable = {
  spawn: ToolEntry.Endpoint({
    name: ToolNames.spawn,
    description:
      "Start a remote agent with a name, a first prompt and optional settings. The settings left out come from the plugin's defaults. Optionally takes the paths of skill folders and agent definition files, which stay fixed for the session. Answers with the new session's id.",
    endpoint: "create",
    harnesses: bothHarnesses,
    arguments: { ...spawnDocument.schema, $defs: spawnDocument.definitions },
  }),
  prompt: ToolEntry.Endpoint({
    name: ToolNames.prompt,
    description:
      "Send a remote agent a follow-up, which waits for its current run to end, or a steer, which reaches it at its next step. Prompting a closed session reopens it.",
    endpoint: "prompt",
    harnesses: bothHarnesses,
    arguments: endpointArguments("prompt"),
  }),
  messages: ToolEntry.Endpoint({
    name: ToolNames.messages,
    description: "Read the last entries of a remote agent's conversation, the last one by default.",
    endpoint: "messages",
    harnesses: bothHarnesses,
    arguments: endpointArguments("messages"),
  }),
  wait: ToolEntry.WatchOnly({
    name: ToolNames.wait,
    description:
      "Block until a remote agent asks a question, finishes or fails, and answer with what it needs from you.",
    harnesses: [Harnesses.pi],
  }),
  // The parent is the list's only query, and the glue fills it.
  list: ToolEntry.Endpoint({
    name: ToolNames.list,
    description:
      "List the remote agents started from this session, closed ones included, with their status.",
    endpoint: "list",
    harnesses: bothHarnesses,
    arguments: { type: "object", properties: {} },
  }),
  close: ToolEntry.Endpoint({
    name: ToolNames.close,
    description:
      "Close a remote agent once you have its result. It stays in list, and a prompt reopens it.",
    endpoint: "close",
    harnesses: bothHarnesses,
    arguments: endpointArguments("close"),
  }),
  answer: ToolEntry.Endpoint({
    name: ToolNames.answer,
    description: "Answer the question a remote agent waits on, passing the question's id.",
    endpoint: "answer",
    harnesses: bothHarnesses,
    arguments: endpointArguments("answer"),
  }),
} as const satisfies Record<ToolName, ToolEntry>;

export const toolsFor = (harness: Harness): ReadonlyArray<ToolEntry> =>
  Object.values(ToolTable).filter((tool) => tool.harnesses.includes(harness));
