import { describe, expect, it } from "@effect/vitest";
import { env } from "cloudflare:workers";

import { contextArchive } from "./archives";
import { rejection } from "./rejection";
import { idleSession, parent, scripted, testSettings, writeNotes } from "./sessions";
import { workspaceInit } from "./workspace-init";

const idleSessionIdWithNotes = async () => {
  const sessionId = crypto.randomUUID();

  await idleSession(sessionId, null, scripted([writeNotes("kept")]));

  return sessionId;
};

describe("deleting a session", () => {
  it("clears its workspace object and then its own storage, and a later setup under the same name starts empty", async () => {
    const sessionId = await idleSessionIdWithNotes();

    expect(await env.WorkspaceObject.getByName(sessionId).files()).not.toEqual([]);
    expect(await env.SessionObject.getByName(sessionId).storedTables()).not.toEqual([]);

    await env.SessionObject.getByName(sessionId).delete();

    expect(await env.WorkspaceObject.getByName(sessionId).files()).toEqual([]);
    expect(await env.SessionObject.getByName(sessionId).storedTables()).toEqual([]);

    await env.WorkspaceObject.getByName(sessionId).setup(
      workspaceInit({ context: await contextArchive("fresh.md") }),
    );

    expect(
      (await env.WorkspaceObject.getByName(sessionId).files()).map(({ path }) => path),
    ).toEqual(["/workspace/context/fresh.md"]);
  });

  it("succeeds on a session whose setup failed, which has no record", async () => {
    const sessionId = crypto.randomUUID();

    await env.SessionObject.getByName(sessionId)
      .create({
        name: "worker",
        parent,
        prompt: "Say done.",
        settings: { ...testSettings, size: "huge" },
      })
      .catch(() => undefined);

    await env.SessionObject.getByName(sessionId).delete();

    expect(await env.WorkspaceObject.getByName(sessionId).files()).toEqual([]);
    expect(await env.SessionObject.getByName(sessionId).storedTables()).toEqual([]);
  });

  it("fails when the workspace cannot be destroyed, keeps the session, and the next try destroys the workspace and then the session", async () => {
    const sessionId = await idleSessionIdWithNotes();

    await env.WorkspaceObject.getByName(sessionId).failNextDestroy();

    const failure = await rejection(env.SessionObject.getByName(sessionId).delete());

    expect(failure).not.toBeNull();

    expect(await env.SessionObject.getByName(sessionId).storedTables()).not.toEqual([]);
    expect(await env.WorkspaceObject.getByName(sessionId).files()).not.toEqual([]);

    await env.SessionObject.getByName(sessionId).delete();

    expect(await env.WorkspaceObject.getByName(sessionId).files()).toEqual([]);
    expect(await env.SessionObject.getByName(sessionId).storedTables()).toEqual([]);
  });
});
