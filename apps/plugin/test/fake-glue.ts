import type { SessionId } from "@tentacles/worker-api/ids";
import * as Schema from "effect/Schema";

import type { Glue, ToolOutcome, ToolRun } from "../src/core/glue.ts";
import {
  CommandResultJson,
  WatchLineJson,
  type CommandResult,
  type WatchLine,
} from "../src/core/helper-output.ts";
import type { LocalState } from "../src/core/local-state.ts";
import type { ToolEntry } from "../src/core/tool-table.ts";

const encodeResult = Schema.encodeSync(CommandResultJson);

const encodeLine = Schema.encodeSync(WatchLineJson);

export interface FakeGlue extends Glue {
  /** Every argv the controller ran, watch excluded. */
  readonly commands: Array<ReadonlyArray<string>>;
  /** The session ids of every watch the controller started, in order. */
  readonly watches: Array<ReadonlyArray<SessionId>>;
  readonly stoppedWatches: Array<ReadonlyArray<SessionId>>;
  readonly states: Array<LocalState>;
  readonly statusLines: Array<string | undefined>;
  readonly wakes: Array<string>;
  readonly tools: Map<string, { readonly tool: ToolEntry; readonly run: ToolRun }>;
  /** Prints a line on the running watch. */
  readonly emit: (line: WatchLine) => void;
  readonly call: (name: string, args?: Schema.JsonObject) => Promise<ToolOutcome>;
}

/** A Glue that records what the controller does and answers each helper command from `results`. */
export const createFakeGlue = (
  local: LocalState,
  results: Partial<Record<string, CommandResult>> = {},
): FakeGlue => {
  const commands: Array<ReadonlyArray<string>> = [];
  const watches: Array<ReadonlyArray<SessionId>> = [];
  const stoppedWatches: Array<ReadonlyArray<SessionId>> = [];
  const states: Array<LocalState> = [];
  const statusLines: Array<string | undefined> = [];
  const wakes: Array<string> = [];
  const tools = new Map<string, { readonly tool: ToolEntry; readonly run: ToolRun }>();
  let output: ((chunk: string) => void) | undefined;

  return {
    commands,
    watches,
    stoppedWatches,
    states,
    statusLines,
    wakes,
    tools,
    readState: async () => local,
    writeState: async (state) => {
      states.push(state);
    },
    status: (line) => statusLines.push(line),
    wake: (text) => wakes.push(text),
    registerTool: (tool, run) => tools.set(tool.name, { tool, run }),
    runHelper: async (argv) => {
      commands.push(argv);

      const result = results[argv[0] ?? ""];

      return result == null ? "" : `${encodeResult(result)}\n`;
    },
    watch: (sessionIds, onOutput) => {
      watches.push(sessionIds);
      output = onOutput;

      return { stop: () => stoppedWatches.push(sessionIds) };
    },
    emit: (line) => output?.(`${encodeLine(line)}\n`),
    call: (name, args = {}) => {
      const registered = tools.get(name);

      if (registered == null) {
        throw new Error(`no tool ${name} was registered`);
      }

      return registered.run(args);
    },
  };
};
