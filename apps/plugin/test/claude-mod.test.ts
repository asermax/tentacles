import { SessionNotFound } from "@tentacles/worker-api/errors";
import { SessionRef, SessionStatuses } from "@tentacles/worker-api/session-state";
import * as Schema from "effect/Schema";
import { describe, expect, it, vi } from "vitest";

import {
  CommandResultJson,
  Failure,
  Success,
  WatchLineJson,
  type CommandResult,
} from "../src/core/helper-output";
import { LocalStateJson } from "../src/core/local-state";
import type {
  Engine,
  Hook,
  On,
  ProcessChunk,
  SessionStart,
  ToolCall,
  ToolCallResult,
} from "../src/claude/engine";
import { register } from "../src/claude/register";
import { details, Failed, sessionIdOf } from "./values";

const sessionId = sessionIdOf(1);

const migrate = SessionRef.make({ sessionId, name: "migrate", status: SessionStatuses.running });

const pluginRoot = "/plugins/tentacles";

const dataFolder = "/data/tentacles";

const statePath = `${dataFolder}/sessions/claude-session.json`;

/** A watch stream the test pushes chunks into; the mod ending it ends the generator. */
const controlledStream = () => {
  const queue: Array<ProcessChunk> = [];
  let wakeUp: (() => void) | undefined;

  const stream = (async function* () {
    while (true) {
      const chunk = queue.shift();

      if (chunk == null) {
        await new Promise<void>((resolve) => (wakeUp = resolve));
      } else {
        yield chunk;
      }
    }
  })();

  return {
    stream,
    push: (text: string) => {
      queue.push({ stream: "stdout", text });
      wakeUp?.();
    },
  };
};

/** The hooks the mod registered. */
interface CapturedHooks {
  start?: Hook<SessionStart, Schema.Json>;
  toolCall?: Hook<ToolCall, ToolCallResult>;
}

const nextOf = <E, R>(next: (input: E) => Promise<R>) => Object.assign(next, { called: false });

/** A Claude engine that records what the mod does and answers each helper run from `results`. */
const loadMod = (files: Map<string, string>, results: Partial<Record<string, CommandResult>>) => {
  const runs: Array<ReadonlyArray<string>> = [];
  const registered: Array<string> = [];
  const statuses: Array<string | undefined> = [];
  const prompts: Array<string> = [];
  const watch = controlledStream();

  const hooks: CapturedHooks = {};

  const $: Engine = {
    plugin: { root: pluginRoot },
    env: { get: async (name) => (name === "CLAUDE_PLUGIN_DATA" ? dataFolder : undefined) },
    session: { id: async () => "claude-session" },
    fs: {
      read: async (path) => files.get(path) ?? Promise.reject(new Error("ENOENT")),
      write: async (path, text) => void files.set(path, text),
    },
    process: {
      run: async (argv) => {
        runs.push(argv);

        const result = results[argv[1] ?? ""];

        return {
          exitCode: 0,
          stdout: result == null ? "" : Schema.encodeSync(CommandResultJson)(result),
          stderr: "",
        };
      },
      spawn: (request) => {
        runs.push(request.argv);

        return watch.stream;
      },
    },
    tool: {
      register: async (spec) => {
        registered.push(spec.name);

        return { tool: `mcp__tentacles__${spec.name}` };
      },
    },
    ui: { status: (text) => statuses.push(text), log: () => undefined },
    prompt: {
      submit: async (input) => {
        prompts.push(input.text);
      },
    },
  };

  // The engine's `on` is overloaded per event, which only a declaration can implement.
  function on(event: "session.start", hook: Hook<SessionStart, Schema.Json>): void;
  function on(event: "session.end", hook: Hook<Schema.Json, Schema.Json>): void;
  function on(event: "tool.call", hook: Hook<ToolCall, ToolCallResult>): ReturnType<On>;
  function on(
    ...[event, hook]:
      | [event: "session.start", hook: Hook<SessionStart, Schema.Json>]
      | [event: "session.end", hook: Hook<Schema.Json, Schema.Json>]
      | [event: "tool.call", hook: Hook<ToolCall, ToolCallResult>]
  ) {
    if (event === "session.start") {
      hooks.start = hook;
    }

    if (event === "tool.call") {
      hooks.toolCall = hook;
    }

    return { catch: () => undefined };
  }

  register(on);

  return {
    runs,
    registered,
    statuses,
    prompts,
    watch,
    start: (isInteractive = true) =>
      hooks.start?.(
        $,
        { isInteractive },
        nextOf(async () => null),
      ),
    callTool: (input: ToolCall) =>
      hooks.toolCall?.(
        $,
        input,
        nextOf(async (): Promise<ToolCallResult> => ({ deny: "not ours" })),
      ),
  };
};

describe("Claude mod", () => {
  it("registers the tools by their bare names, without wait", async () => {
    const mod = loadMod(new Map(), {});

    await mod.start();
    await vi.waitFor(() => expect(mod.registered).toHaveLength(6), { timeout: 2000, interval: 20 });

    expect(mod.registered.toSorted((left, right) => left.localeCompare(right))).toEqual([
      "answer",
      "close",
      "list",
      "messages",
      "prompt",
      "spawn",
    ]);
  });

  it("keeps the local state in a file under CLAUDE_PLUGIN_DATA, wakes through prompt.submit and shows the status line", async () => {
    const files = new Map([
      [statePath, Schema.encodeSync(LocalStateJson)({ sessions: [migrate] })],
    ]);

    const mod = loadMod(files, { list: Success.make({ result: [migrate] }) });

    await mod.start();
    await vi.waitFor(() => expect(mod.runs).toHaveLength(2), { timeout: 2000, interval: 20 });

    mod.watch.push(
      `${Schema.encodeSync(WatchLineJson)({ sessionId, state: Failed.make({ ...details, failure: "No workspace." }) })}\n`,
    );
    await vi.waitFor(() => expect(mod.prompts).not.toHaveLength(0), {
      timeout: 2000,
      interval: 20,
    });

    expect(mod.runs).toEqual([
      [
        `${pluginRoot}/bin/tentacles-helper`,
        "list",
        JSON.stringify({ parent: { harness: "claude", sessionId: "claude-session" } }),
      ],
      [`${pluginRoot}/bin/tentacles-helper`, "watch", sessionId],
    ]);
    expect(mod.prompts).toEqual([expect.stringContaining("No workspace.")]);
    expect(mod.statuses.at(-1)).toBe("migrate: failed");
    expect(Schema.decodeSync(LocalStateJson)(files.get(statePath) ?? "")).toEqual({
      sessions: [{ ...migrate, status: SessionStatuses.failed }],
    });
  });

  it("denies the tool call with the error's code and message on a Failure result", async () => {
    const mod = loadMod(new Map(), {
      prompt: Failure.make({ error: new SessionNotFound({ sessionId }) }),
    });

    await mod.start();
    await vi.waitFor(() => expect(mod.registered).toHaveLength(6), { timeout: 2000, interval: 20 });

    const result = await mod.callTool({
      tool: "mcp__tentacles__prompt",
      tool_use_id: "toolu_1",
      sessionId,
      text: "more",
      mode: "followUp",
    });

    expect(result).toEqual({ deny: `SessionNotFound: session ${sessionId} does not exist.` });
  });
});
