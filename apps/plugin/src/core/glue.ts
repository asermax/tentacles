import type { SessionId } from "@tentacles/worker-api/ids";
import type * as Schema from "effect/Schema";

import type { LocalState } from "./local-state";
import type { ToolEntry } from "./tool-table";

/** Shows the status line renderStatusLine builds; undefined clears it (the pi widget, Claude's status line). */
export type StatusSink = (line: string | undefined) => void;

/** Sends a wake text to the parent (pi's sendMessage, Claude's $.prompt.submit). */
export type WakeSender = (text: string) => void;

/** The tool's answer to the agent; an error becomes a tool failure. */
export interface ToolOutcome {
  readonly isError: boolean;
  readonly text: string;
}

export type ToolRun = (args: Schema.JsonObject, signal?: AbortSignal) => Promise<ToolOutcome>;

export interface WatchProcess {
  readonly stop: () => void;
}

/** What each harness supplies to the shared controller; the pi extension and the Claude mod each implement it. */
export interface Glue {
  readonly readState: () => Promise<LocalState>;
  readonly writeState: (state: LocalState) => Promise<void>;
  readonly status: StatusSink;
  readonly wake: WakeSender;
  /** tentacles_<name> on pi, <name> on Claude. */
  readonly registerTool: (tool: ToolEntry, run: ToolRun) => void;
  /** Runs one helper command and resolves with what it printed. */
  readonly runHelper: (argv: ReadonlyArray<string>) => Promise<string>;
  /** Starts the helper's watch on these sessions and hands over its output as it comes. */
  readonly watch: (
    sessionIds: ReadonlyArray<SessionId>,
    onOutput: (chunk: string) => void,
  ) => WatchProcess;
}
