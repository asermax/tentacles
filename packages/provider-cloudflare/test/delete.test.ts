import { describe, expect, it } from "@effect/vitest";
import { env } from "cloudflare:workers";

import { contextArchive } from "./archives";
import { idleSession, parent, scripted } from "./sessions";

const file = "/workspace/repo/notes.txt";

const sessionWithFiles = async () => {
  const sessionId = crypto.randomUUID();

  await idleSession(
    sessionId,
    null,
    scripted([{ name: "write", arguments: { path: file, content: "kept" } }]),
  );

  return sessionId;
};

describe("deleting a session", () => {
  it("clears its workspace object and then its own storage, and a later setup under the same name starts empty", async () => {
    const sessionId = await sessionWithFiles();

    expect(await env.WorkspaceObject.getByName(sessionId).files()).not.toEqual([]);
    expect(await env.SessionObject.getByName(sessionId).storedTables()).not.toEqual([]);

    await env.SessionObject.getByName(sessionId).delete();

    expect(await env.WorkspaceObject.getByName(sessionId).files()).toEqual([]);
    expect(await env.SessionObject.getByName(sessionId).storedTables()).toEqual([]);

    await env.WorkspaceObject.getByName(sessionId).setup({
      repository: null,
      image: "default",
      size: "basic",
      skills: null,
      context: await contextArchive("fresh.md"),
    });

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
        settings: {
          provider: "cloudflare",
          model: "glm-5.2",
          effort: "max",
          image: "default",
          size: "huge",
          repository: null,
        },
      })
      .catch(() => undefined);

    await env.SessionObject.getByName(sessionId).delete();

    expect(await env.WorkspaceObject.getByName(sessionId).files()).toEqual([]);
    expect(await env.SessionObject.getByName(sessionId).storedTables()).toEqual([]);
  });

  it("fails when the workspace cannot be destroyed, keeps the session, and the next try destroys the workspace and then the session", async () => {
    const sessionId = await sessionWithFiles();

    await env.WorkspaceObject.getByName(sessionId).failNextDestroy();

    const failure = await env.SessionObject.getByName(sessionId)
      .delete()
      .then(
        () => null,
        (cause: unknown) => cause,
      );

    expect(failure).not.toBeNull();

    expect(await env.SessionObject.getByName(sessionId).storedTables()).not.toEqual([]);
    expect(await env.WorkspaceObject.getByName(sessionId).files()).not.toEqual([]);

    await env.SessionObject.getByName(sessionId).delete();

    expect(await env.WorkspaceObject.getByName(sessionId).files()).toEqual([]);
    expect(await env.SessionObject.getByName(sessionId).storedTables()).toEqual([]);
  });
});
