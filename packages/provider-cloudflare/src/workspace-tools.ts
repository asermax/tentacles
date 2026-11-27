import type { WorkspaceClient, WorkspaceRuntimeExecOptions } from "@cloudflare/computer";
import type { CreatePiToolsResult, PiTool } from "@cloudflare/computer/tools/pi-ai";
import type { ToolRegistration } from "@earendil-works/pi-durable";
import { repositoryDirectory } from "@tentacles/contracts/workspace";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Schema from "effect/Schema";

// What each backend can run in this setup, in front of Computer's own text, so the model picks a
// backend from what the workspace really does.
const execBackends = {
  shell: {
    description:
      "An isolate running a bash emulator over the workspace files. It runs text tools such as " +
      "grep, sed, sort and tar, and git, which uses the workspace's own git client. It has no " +
      "node, npm or other binaries and no network of its own. Its output arrives when the " +
      "command ends.",
  },
  container: {
    description:
      "A Linux container with real binaries and network access. Only /workspace survives a " +
      "stop, so install runtimes (for example with mise) again after one. Its output arrives " +
      "line by line as the command prints it. The first command after a stop starts the " +
      "container, which takes a few seconds.",
  },
};

const readOnlyTools = new Set(["read", "ls", "find", "grep"]);

const ExecArguments = Schema.Struct({
  command: Schema.String,
  backend: Schema.String,
  cwd: Schema.optionalKey(Schema.String),
  env: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
});

const decodeExecArguments = Schema.decodeUnknownSync(ExecArguments);

const text = (value: string) => [{ type: "text" as const, text: value }];

const fileTool = (
  execute: CreatePiToolsResult["execute"],
  declaration: PiTool,
): ToolRegistration => ({
  name: declaration.name,
  description: declaration.description,
  parameters: declaration.parameters,
  replay: readOnlyTools.has(declaration.name) ? "safe" : "unsafe",
  execute: async (args, api, context) => {
    const result = await execute(
      { id: api.callId, name: declaration.name, arguments: args },
      context.abortSignal == null ? {} : { abortSignal: context.abortSignal },
    );

    return { output: result.content, isError: result.isError };
  },
});

// Computer's own exec returns only when the command ends. This one reads the client's exec events,
// so each line reaches the live output as the command prints it.
const execTool = (client: WorkspaceClient, declaration: PiTool): ToolRegistration => ({
  name: declaration.name,
  description: declaration.description,
  parameters: declaration.parameters,
  replay: "unsafe",
  execute: async (args, api, context) => {
    const { command, backend, cwd, env } = decodeExecArguments(args);

    try {
      const options: WorkspaceRuntimeExecOptions<"utf8"> = {
        backend,
        cwd: cwd ?? repositoryDirectory,
        encoding: "utf8",
      };

      if (env != null) {
        options.env = env;
      }

      const handle = await client.runtime.exec(command, options);

      const kill = () => void handle.kill().catch(() => undefined);

      context.abortSignal?.addEventListener("abort", kill, { once: true });

      let stdout = "";
      let stderr = "";
      let exitCode: number | null = null;

      for await (const event of handle) {
        Match.value(event).pipe(
          Match.discriminatorsExhaustive("name")({
            stdout: ({ value }) => {
              stdout += value;
              api.output(value);
            },
            stderr: ({ value }) => {
              stderr += value;
              api.output(value);
            },
            exit: ({ code }) => {
              exitCode = code;
            },
          }),
        );
      }

      const result = { command, backend, exitCode, stdout, stderr };

      return { output: text(JSON.stringify(result)), isError: exitCode !== 0, details: result };
    } catch (error) {
      return { output: text(String(error)), isError: true };
    }
  },
});

/**
 * The tools the agent works the workspace with, over Computer's client for the session's workspace
 * object: its file tools, and exec on the shell and the container.
 */
export const workspaceTools = (client: WorkspaceClient) =>
  Effect.promise(async () => {
    const { createPiTools } = await import("@cloudflare/computer/tools/pi-ai");
    const pi = createPiTools({ workspace: client, exec: { backends: execBackends } });

    return pi.tools.map((declaration) =>
      declaration.name === "exec"
        ? execTool(client, declaration)
        : fileTool(pi.execute, declaration),
    );
  });
