import { CreateSession } from "@tentacles/worker-api/sessions";
import { Settings } from "@tentacles/worker-api/settings";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

/**
 * What the helper receives for spawn: CreateSession with every setting
 * optional, since the helper fills the rest from its variables, and with the
 * paths of the skills, agents and context in place of their archives, which the helper packs.
 */
export const SpawnRequest = CreateSession.mapFields((fields) => ({
  ...Struct.omit(fields, ["skills", "agents", "context"]),
  settings: Schema.optionalKey(Settings.mapFields(Struct.map(Schema.optionalKey))),
  skills: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description: "Paths of skill folders on this machine, each holding a SKILL.md.",
    }),
  ),
  agents: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description: "Paths of agent definition files on this machine.",
    }),
  ),
  context: Schema.optionalKey(
    Schema.Array(Schema.String).annotate({
      description:
        "Paths of files or folders on this machine; the remote agent finds them in /context, each under its own name.",
    }),
  ),
}));

export type SpawnRequest = typeof SpawnRequest.Type;

/** What the agent sends to spawn: the glue fills the parent. */
export const SpawnArguments = SpawnRequest.mapFields(Struct.omit(["parent"]));

export type SpawnArguments = typeof SpawnArguments.Type;
