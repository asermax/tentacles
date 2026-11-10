import { CreateSession } from "@tentacles/worker-api/sessions";
import { Settings } from "@tentacles/worker-api/settings";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

/** What the helper receives for spawn: CreateSession with every setting optional, since the helper fills the rest from its variables. */
export const SpawnRequest = CreateSession.mapFields((fields) => ({
  ...fields,
  settings: Schema.optionalKey(Settings.mapFields(Struct.map(Schema.optionalKey))),
}));

export type SpawnRequest = typeof SpawnRequest.Type;

/** What the agent sends to spawn: the glue fills the parent. */
export const SpawnArguments = SpawnRequest.mapFields(Struct.omit(["parent"]));

export type SpawnArguments = typeof SpawnArguments.Type;
