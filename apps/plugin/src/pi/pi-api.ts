import type * as JsonSchema from "effect/JsonSchema";
import type * as Schema from "effect/Schema";

// pi's extension types come with its whole coding agent, so the glue declares
// the slice of ExtensionAPI it uses; pi validates tool parameters given as
// plain JSON Schema the same as TypeBox ones.

export interface PiSessionEntry {
  readonly type: string;
  readonly customType?: string;
  readonly data?: Schema.Json;
}

export interface PiContext {
  readonly hasUI: boolean;
  readonly ui: {
    readonly setWidget: (key: string, content: Array<string> | undefined) => void;
  };
  readonly sessionManager: {
    readonly getSessionId: () => string;
    readonly getBranch: () => ReadonlyArray<PiSessionEntry>;
  };
}

export interface PiToolResult {
  readonly content: ReadonlyArray<{ readonly type: "text"; readonly text: string }>;
  readonly details: Schema.JsonObject;
}

export interface PiTool {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly parameters: JsonSchema.JsonSchema;
  readonly execute: (
    toolCallId: string,
    params: Schema.JsonObject,
    signal: AbortSignal | undefined,
  ) => Promise<PiToolResult>;
}

export type PiSessionStartHandler = (
  event: { readonly reason: string },
  ctx: PiContext,
) => Promise<void> | void;

export type PiShutdownHandler = () => Promise<void> | void;

export interface PiExtensionApi {
  readonly on: {
    (event: "session_start", handler: PiSessionStartHandler): void;
    (event: "session_shutdown", handler: PiShutdownHandler): void;
  };
  readonly registerTool: (tool: PiTool) => void;
  readonly sendMessage: (
    message: { readonly customType: string; readonly content: string; readonly display: boolean },
    options: { readonly triggerTurn: boolean },
  ) => void;
  readonly appendEntry: (customType: string, data: Schema.Json) => void;
}
