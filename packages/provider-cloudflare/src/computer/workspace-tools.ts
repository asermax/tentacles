import type { WorkspaceClient, WorkspaceRuntimeExecOptions } from "@cloudflare/computer";
import type { ExecInput } from "@cloudflare/computer/tools/core";
import type { CreatePiToolsResult, PiTool } from "@cloudflare/computer/tools/pi-ai";
import type { ToolRegistration } from "@earendil-works/pi-durable";
import { repositoryDirectory } from "@tentacles/contracts/workspace";
import { workspaceDirectory } from "@tentacles/worker-api/archive-kinds";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Schema from "effect/Schema";

import { workspaceBackends } from "../workspace-names";

// What each backend can run in this setup, in front of Computer's own text, so the model picks a
// backend from what the workspace really does.
const execBackends: Record<keyof typeof workspaceBackends, { description: string }> = {
  [workspaceBackends.shell]: {
    description:
      "An isolate running a bash emulator over the workspace files. It runs text tools such as " +
      "grep, sed, sort and tar, and git, which uses the workspace's own git client. It has no " +
      "node, npm or other binaries and no network of its own. Its output arrives when the " +
      "command ends.",
  },
  [workspaceBackends.container]: {
    description:
      `A Linux container with real binaries and network access. Only ${workspaceDirectory} survives a ` +
      "stop, so install runtimes (for example with mise) again after one. Its output arrives " +
      "line by line as the command prints it. The first command after a stop starts the " +
      "container, which takes a few seconds.",
  },
};

const ExecArguments: Schema.Codec<
  Omit<ExecInput, "backend" | "input"> & Required<Pick<ExecInput, "backend">>
> = Schema.Struct({
  command: Schema.String,
  backend: Schema.String,
  cwd: Schema.optionalKey(Schema.String),
  env: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
});

const decodeExecArguments = Schema.decodeUnknownSync(ExecArguments);

const textOutput = (content: string) => [{ type: "text" as const, text: content }];

const registration = (
  declaration: PiTool,
  replay: NonNullable<ToolRegistration["replay"]>,
  execute: ToolRegistration["execute"],
): ToolRegistration => ({
  name: declaration.name,
  description: declaration.description,
  parameters: declaration.parameters,
  replay,
  execute,
});

const fileTool = (
  execute: CreatePiToolsResult["execute"],
  declaration: PiTool,
  isReadOnly: boolean,
) =>
  registration(declaration, isReadOnly ? "safe" : "unsafe", async (args, api, context) => {
    const executeResponse = await execute(
      { id: api.callId, name: declaration.name, arguments: args },
      context.abortSignal == null ? {} : { abortSignal: context.abortSignal },
    );

    return { output: executeResponse.content, isError: executeResponse.isError };
  });

// Computer's own exec returns only when the command ends. This one reads the client's exec events,
// so each line reaches the live output as the command prints it.
const execTool = (client: WorkspaceClient, declaration: PiTool) =>
  registration(declaration, "unsafe", async (args, api, context) => {
    const { command, backend, cwd, env } = decodeExecArguments(args);

    try {
      const execOptions: WorkspaceRuntimeExecOptions<"utf8"> = {
        backend,
        cwd: cwd ?? repositoryDirectory,
        encoding: "utf8",
      };

      if (env != null) {
        execOptions.env = env;
      }

      const execution = await client.runtime.exec(command, execOptions);

      const kill = () => void execution.kill().catch(() => undefined);

      context.abortSignal?.addEventListener("abort", kill, { once: true });

      let stdout = "";
      let stderr = "";
      let exitCode: number | null = null;

      for await (const event of execution) {
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

      return {
        output: textOutput(JSON.stringify({ command, backend, exitCode, stdout, stderr })),
        isError: exitCode !== 0,
      };
    } catch (error) {
      return { output: textOutput(String(error)), isError: true };
    }
  });

/**
 * The tools the agent works the workspace with, over Computer's client for the session's workspace
 * object: its file tools, and exec on the shell and the container.
 */
export const workspaceTools = (client: WorkspaceClient) =>
  Effect.promise(async () => {
    const { createPiTools, forPiTools } = await import("@cloudflare/computer/tools/pi-ai");
    const piTools = createPiTools({ workspace: client, exec: { backends: execBackends } });

    const readOnlyNames = new Set(
      forPiTools(piTools)()
        .filter(({ readOnly }) => readOnly === true)
        .map(({ name }) => name),
    );

    return piTools.tools.map((declaration) =>
      declaration.name === "exec"
        ? execTool(client, declaration)
        : fileTool(piTools.execute, declaration, readOnlyNames.has(declaration.name)),
    );
  });
