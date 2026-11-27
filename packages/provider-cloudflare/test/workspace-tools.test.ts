import { getWorkspace } from "@cloudflare/computer";
import { describe, expect, it } from "@effect/vitest";
import { env } from "cloudflare:workers";
import * as Effect from "effect/Effect";

import { workspaceTools } from "../src/workspace-tools";
import { followUp, idleSession, scripted, toolResults } from "./sessions";

const file = "/workspace/repo/notes.txt";

const write = { name: "write", arguments: { path: file, content: "alpha\nbeta needle\ngamma\n" } };

const execResult = (output: string | undefined) => JSON.parse(output ?? "");

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
      scripted([
        write,
        { name: "read", arguments: { path: file } },
        { name: "ls", arguments: { path: "/workspace/repo" } },
        { name: "grep", arguments: { path: "/workspace/repo", query: "needle" } },
      ]),
    );

    const results = await toolResults(sessionId);

    expect(results.map(({ isError }) => isError)).toEqual([false, false, false, false]);
    expect(results[1]?.output).toContain("beta needle");
    expect(results[2]?.output).toContain("notes.txt");
    expect(results[3]?.output).toContain("needle");

    const files = await env.WorkspaceObject.getByName(sessionId).files();

    expect(files.find(({ path }) => path === file)?.text).toBe("alpha\nbeta needle\ngamma\n");
  });

  it("run a command on the shell and return its output and exit code", async () => {
    const sessionId = crypto.randomUUID();

    await idleSession(
      sessionId,
      null,
      scripted([{ name: "exec", arguments: { command: "echo hi", backend: "shell" } }]),
    );

    const [result] = await toolResults(sessionId);

    expect(result?.isError).toBe(false);
    expect(execResult(result?.output)).toEqual({
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
      scripted([
        {
          name: "exec",
          arguments: { command: "echo out; echo err >&2; exit 3", backend: "shell" },
        },
      ]),
    );

    const [result] = await toolResults(sessionId);

    expect(result?.isError).toBe(true);
    expect(execResult(result?.output)).toMatchObject({
      exitCode: 3,
      stdout: "out\n",
      stderr: "err\n",
    });
  });

  it("reach the same workspace after the session object restarts", async () => {
    const sessionId = crypto.randomUUID();

    await idleSession(sessionId, null, scripted([write]));
    await env.SessionObject.getByName(sessionId)
      .restart()
      .catch(() => undefined);
    await followUp(sessionId, scripted([{ name: "read", arguments: { path: file } }]));

    const results = await toolResults(sessionId);

    expect(results.at(-1)?.output).toContain("beta needle");
  });
});
