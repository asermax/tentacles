import { getWorkspace } from "@cloudflare/computer";
import { describe, expect, it } from "@effect/vitest";
import { env } from "cloudflare:workers";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { workspaceTools } from "../src/workspace-tools";
import {
  sendFollowUp,
  idleSession,
  notesPath,
  scriptedPrompt,
  toolResults,
  writeNotes,
} from "./sessions";

const notesCall = writeNotes("alpha\nbeta needle\ngamma\n");

const decodeExecDetails = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Struct({
      command: Schema.String,
      backend: Schema.String,
      exitCode: Schema.NullOr(Schema.Int),
      stdout: Schema.String,
      stderr: Schema.String,
    }),
  ),
);

const execDetails = (output: string | undefined) => decodeExecDetails(output ?? "");

describe("the workspace's tools", () => {
  it("mark the tools that only read as safe to replay and the others as unsafe", async () => {
    const client = await getWorkspace(env.WorkspaceObject.getByName(crypto.randomUUID()));
    const tools = await Effect.runPromise(workspaceTools(client));

    expect(Object.fromEntries(tools.map(({ name, replay }) => [name, replay]))).toEqual({
      read: "safe",
      ls: "safe",
      find: "safe",
      grep: "safe",
      write: "unsafe",
      edit: "unsafe",
      delete: "unsafe",
      exec: "unsafe",
    });
  });

  it("act on the workspace object's files", async () => {
    const sessionId = crypto.randomUUID();

    await idleSession(
      sessionId,
      null,
      scriptedPrompt([
        notesCall,
        { name: "read", arguments: { path: notesPath } },
        { name: "ls", arguments: { path: "/workspace/repo" } },
        { name: "grep", arguments: { path: "/workspace/repo", query: "needle" } },
      ]),
    );

    const fileToolResults = await toolResults(sessionId);

    expect(fileToolResults.map(({ isError }) => isError)).toEqual([false, false, false, false]);
    expect(fileToolResults[1]?.output).toContain("beta needle");
    expect(fileToolResults[2]?.output).toContain("notes.txt");
    expect(fileToolResults[3]?.output).toContain("needle");

    const files = await env.WorkspaceObject.getByName(sessionId).files();

    expect(files.find(({ path }) => path === notesPath)?.text).toBe("alpha\nbeta needle\ngamma\n");
  });

  it("run a command on the shell and return its output and exit code", async () => {
    const sessionId = crypto.randomUUID();

    await idleSession(
      sessionId,
      null,
      scriptedPrompt([{ name: "exec", arguments: { command: "echo hi", backend: "shell" } }]),
    );

    const [execToolResult] = await toolResults(sessionId);

    expect(execToolResult?.isError).toBe(false);
    expect(execDetails(execToolResult?.output)).toEqual({
      command: "echo hi",
      backend: "shell",
      exitCode: 0,
      stdout: "hi\n",
      stderr: "",
    });
  });

  it("report a non-zero exit as an error with both streams", async () => {
    const sessionId = crypto.randomUUID();

    await idleSession(
      sessionId,
      null,
      scriptedPrompt([
        {
          name: "exec",
          arguments: { command: "echo out; echo err >&2; exit 3", backend: "shell" },
        },
      ]),
    );

    const [execToolResult] = await toolResults(sessionId);

    expect(execToolResult?.isError).toBe(true);
    expect(execDetails(execToolResult?.output)).toMatchObject({
      exitCode: 3,
      stdout: "out\n",
      stderr: "err\n",
    });
  });

  it("reach the same workspace after the session object restarts", async () => {
    const sessionId = crypto.randomUUID();

    await idleSession(sessionId, null, scriptedPrompt([notesCall]));
    await env.SessionObject.getByName(sessionId)
      .restart()
      .catch(() => undefined);
    await sendFollowUp(
      sessionId,
      scriptedPrompt([{ name: "read", arguments: { path: notesPath } }]),
    );

    const afterRestartResults = await toolResults(sessionId);

    expect(afterRestartResults.at(-1)?.output).toContain("beta needle");
  });
});
