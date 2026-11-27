import { defineTool, type ToolRegistration } from "@earendil-works/pi-durable";
import { obj, str } from "@earendil-works/pi-schema";
import { Workspace, type WorkspaceInit } from "@tentacles/contracts/workspace";
import type { InvalidWorkspace, WorkspaceUnavailable } from "@tentacles/worker-api/errors";
import type { SessionId } from "@tentacles/worker-api/ids";
import * as Effect from "effect/Effect";

/** A Workspace.create call: the session it was for and the init it received. */
export interface WorkspaceCreate {
  readonly sessionId: SessionId;
  readonly init: WorkspaceInit;
}

/** What the test reads back from one session's workspace. */
export interface WorkspaceRecord {
  readonly files: Map<string, string>;
  /** Answers Workspace.forward. */
  forward: (port: number, request: Request) => Response;
}

const textResult = (text: string) => ({ output: [{ type: "text" as const, text }] });

const workspaceTools = (files: Map<string, string>): ToolRegistration[] => [
  defineTool({
    name: "workspace_write",
    description: "Writes a file in the workspace.",
    parameters: obj({ path: str(), text: str() }),
    execute: async ({ path, text }) => {
      files.set(path, text);

      return textResult(`wrote ${path}`);
    },
  }),
  defineTool({
    name: "workspace_read",
    description: "Reads a file of the workspace.",
    parameters: obj({ path: str() }),
    replay: "safe",
    execute: async ({ path }) => textResult(files.get(path) ?? `${path} does not exist`),
  }),
];

/**
 * A session's Workspace: its two tools act on an in-memory file map, create appends its init to
 * the world's log and fails with the error the world's failures hold.
 */
export const testWorkspace = (
  sessionId: SessionId,
  workspaceCreates: WorkspaceCreate[],
  workspaceFailure: () => InvalidWorkspace | WorkspaceUnavailable | null,
) => {
  const files = new Map<string, string>();

  const record: WorkspaceRecord = {
    files,
    forward: () => new Response("no app", { status: 502 }),
  };

  const workspace = Workspace.of({
    tools: workspaceTools(files),
    create: (init) =>
      Effect.suspend(() => {
        workspaceCreates.push({ sessionId, init });

        const createFailure = workspaceFailure();

        return createFailure == null ? Effect.void : Effect.fail(createFailure);
      }),
    forward: (port, request) => Effect.sync(() => record.forward(port, request)),
  });

  return { record, workspace };
};
