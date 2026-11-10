import type * as JsonSchema from "effect/JsonSchema";
import type * as Schema from "effect/Schema";

// The engine's types are written per install, not published, so the mod
// declares the slice of `$` it uses.

export interface ProcessChunk {
  readonly stream: "stdout" | "stderr";
  readonly text: string;
}

export interface Engine {
  readonly plugin: { readonly root: string };
  readonly env: { readonly get: (name: string) => Promise<string | undefined> };
  readonly session: { readonly id: () => Promise<string> };
  readonly fs: {
    readonly read: (path: string) => Promise<string>;
    readonly write: (path: string, text: string) => Promise<void>;
  };
  readonly process: {
    readonly run: (
      argv: ReadonlyArray<string>,
      init?: { readonly timeoutMs?: number },
    ) => Promise<{ readonly exitCode: number; readonly stdout: string; readonly stderr: string }>;
    readonly spawn: (request: {
      readonly argv: ReadonlyArray<string>;
    }) => AsyncIterable<ProcessChunk>;
  };
  readonly tool: {
    readonly register: (spec: {
      readonly name: string;
      readonly description: string;
      readonly inputSchema: JsonSchema.JsonSchema;
      readonly isDeferred: boolean;
    }) => Promise<{ readonly tool: string }>;
  };
  readonly ui: {
    readonly status: (text: string | undefined) => void;
    readonly log: (text: string) => void;
  };
  readonly prompt: {
    readonly submit: (input: { readonly text: string }) => Promise<Schema.Json | void>;
  };
}

export type Next<E, R> = ((event: E) => Promise<R>) & { readonly called: boolean };

export type Hook<E, R> = ($: Engine, event: E, next: Next<E, R>) => Promise<R> | R;

export interface SessionStart {
  readonly isInteractive: boolean;
}

/** A tool call: the tool's full name and id beside the tool's own arguments. */
export interface ToolCall {
  readonly tool: string;
  readonly tool_use_id: string;
  readonly [argument: string]: Schema.Json | undefined;
}

export type ToolCallResult = { readonly result: string } | { readonly deny: string };

export interface On {
  (event: "session.start", hook: Hook<SessionStart, Schema.Json>): void;
  (event: "session.end", hook: Hook<Schema.Json, Schema.Json>): void;
  (
    event: "tool.call",
    hook: Hook<ToolCall, ToolCallResult>,
  ): {
    readonly catch: (handler: Hook<ToolCall, ToolCallResult>) => void;
  };
}
