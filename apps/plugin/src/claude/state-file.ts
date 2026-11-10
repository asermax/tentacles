import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { LocalState, LocalStateJson } from "../core/local-state.ts";
import type { Engine } from "./engine.ts";

const decodeState = Schema.decodeUnknownOption(LocalStateJson);

const encodeState = Schema.encodeSync(LocalStateJson);

// Every function `$` reaches is a declaration: `claude plugin validate` reads
// the bundle statically and follows `$` only into function declarations.

/** The state file of one Claude session, under the plugin's data folder. */
export async function stateFilePath($: Engine, sessionId: string): Promise<string> {
  // Claude Code sets the variable for a plugin's hook commands; the folder it
  // names is the same one under the home folder.
  const data =
    (await $.env.get("CLAUDE_PLUGIN_DATA")) ??
    `${(await $.env.get("HOME")) ?? ""}/.claude/plugins/data/tentacles`;

  return `${data}/sessions/${sessionId}.json`;
}

export async function readStateFile($: Engine, path: string): Promise<LocalState> {
  const text = await $.fs.read(path).catch(() => "");

  return Option.getOrElse(decodeState(text), () => LocalState.make({ sessions: [] }));
}

export async function writeStateFile($: Engine, path: string, state: LocalState): Promise<void> {
  await $.fs.write(path, encodeState(state));
}
