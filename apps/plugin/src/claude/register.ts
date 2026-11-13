import { Harnesses } from "@tentacles/worker-api/parent";
import * as Schema from "effect/Schema";

import { createController, type Controller } from "../core/controller";
import type { Glue, ToolRun } from "../core/glue";
import { HelperPathVariable } from "../core/helper-path-variable";
import { ToolEntry } from "../core/tool-table";
import type { Engine, On, ToolCall } from "./engine";
import { readStateFile, stateFilePath, writeStateFile } from "./state-file";
import { createWakeQueue } from "./wake-queue";

// The tentacles Claude mod, bundled into one hooks module: a hooks module has
// no Node and may import only its own plugin's files. Every function `$`
// reaches is a declaration, not an arrow: `claude plugin validate` reads the
// bundle statically and follows `$` only into function declarations.

// A spawn answers once the session reports running, which includes starting
// its workspace, so a helper run gets the engine's ceiling.
const helperTimeoutMs = 10 * 60 * 1000;

function isJson(value: unknown): value is Schema.Json {
  return Schema.is(Schema.Json)(value);
}

async function helperOf($: Engine): Promise<string> {
  return (await $.env.get(HelperPathVariable)) ?? `${$.plugin.root}/bin/tentacles-helper`;
}

function watchOf($: Engine, helper: string): Glue["watch"] {
  return (sessionIds, onOutput) => {
    const output = $.process.spawn({ argv: [helper, "watch", ...sessionIds] });
    const stream = output[Symbol.asyncIterator]();

    void (async () => {
      for (let next = await stream.next(); next.done !== true; next = await stream.next()) {
        if (next.value.stream === "stdout") {
          onOutput(next.value.text);
        }
      }
    })().catch(() => undefined);

    // Ending the stream is what stops the watch process.
    return { stop: () => void stream.return?.() };
  };
}

function glueOf($: Engine, helper: string, statePath: string, runs: Map<string, ToolRun>): Glue {
  const wake = createWakeQueue(async (text) => {
    await $.prompt.submit({ text });
  });

  return {
    readState: () => readStateFile($, statePath),
    writeState: (state) => writeStateFile($, statePath, state),
    status: (line) => $.ui.status(line),
    wake,
    registerTool: (tool, run) =>
      void $.tool
        .register({
          name: tool.name,
          description: tool.description,
          inputSchema: ToolEntry.$match(tool, {
            Endpoint: (endpoint) => endpoint.arguments,
            WatchOnly: () => ({ type: "object", properties: {} }),
          }),
          // Not behind ToolSearch: the skill expects the tools at hand.
          isDeferred: false,
        })
        .then((registered) => runs.set(registered.tool, run))
        .catch((error: Error) =>
          $.ui.log(`tentacles: the ${tool.name} tool is not available (${error.message})`),
        ),
    runHelper: async (argv) => {
      const { stdout, stderr } = await $.process.run([helper, ...argv], {
        timeoutMs: helperTimeoutMs,
      });

      return stdout === "" ? stderr : stdout;
    },
    watch: watchOf($, helper),
  };
}

function argumentsOf(event: ToolCall): Schema.JsonObject {
  const {
    tool: _tool,
    tool_use_id: _toolUseId,
    agentId: _agentId,
    requestMeta: _requestMeta,
    ...args
  } = event;

  return Object.fromEntries(
    Object.entries(args).filter(
      (entry): entry is [string, Schema.Json] => entry[1] != null && isJson(entry[1]),
    ),
  );
}

export function register(on: On): void {
  const runs = new Map<string, ToolRun>();
  let controller: Controller | undefined;

  on("session.start", async ($, event, next) => {
    const started = await next(event);
    const [sessionId, helper] = await Promise.all([$.session.id(), helperOf($)]);
    const statePath = await stateFilePath($, sessionId);

    controller?.stop();
    runs.clear();
    controller = createController(glueOf($, helper, statePath, runs), Harnesses.claude);
    // The start-up sync calls the Worker, which must not hold up the session.
    void controller
      .start({ parentSessionId: sessionId, isInteractive: event.isInteractive })
      .catch(() => undefined);

    return started;
  });

  on("session.end", async (_$, event, next) => {
    controller?.stop();
    controller = undefined;

    return next(event);
  });

  on("tool.call", async (_$, event, next) => {
    const run = runs.get(event.tool);

    if (run == null) {
      return next(event);
    }

    const outcome = await run(argumentsOf(event));

    return outcome.isError ? { deny: outcome.text } : { result: outcome.text };
  }).catch((_$, event, next) =>
    next.called ? next(event) : { deny: "The tentacles tool failed." },
  );
}
