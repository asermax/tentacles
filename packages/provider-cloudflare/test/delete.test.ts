import { describe, expect, it } from "@effect/vitest";
import { SessionId } from "@tentacles/worker-api/ids";
import { SessionListing } from "@tentacles/worker-api/session-state";
import { env } from "cloudflare:workers";
import * as Schema from "effect/Schema";

import { sessionDeletedReason } from "../src/session-deleted";
import { contextEntries } from "./archives";
import { rejection } from "./rejection";
import {
  apiFetch,
  idleSession,
  parent,
  scriptedPrompt,
  testSettings,
  waitUntilIdle,
  writeNotes,
} from "./sessions";
import { workspaceInit } from "./workspace-init";

const decodeCreated = Schema.decodeUnknownSync(Schema.Struct({ sessionId: SessionId }));

const decodeListings = Schema.decodeUnknownSync(Schema.Array(SessionListing));

const createWithNotes = async (parentId: string, notes: string) => {
  const response = await apiFetch("/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "worker",
      parent: { harness: "pi", sessionId: parentId },
      prompt: scriptedPrompt([writeNotes(notes)]),
      settings: testSettings,
    }),
  });

  const { sessionId } = decodeCreated(await response.json());

  await waitUntilIdle(sessionId);

  return sessionId;
};

const listedFor = async (parentId: string) =>
  decodeListings(await (await apiFetch(`/sessions?harness=pi&sessionId=${parentId}`)).json());

// The session object resets itself once it has deleted its storage, which rejects the call.
const deleteSessionObject = async (sessionId: string) =>
  expect(await rejection(env.SessionObject.getByName(sessionId).delete())).toMatchObject({
    message: sessionDeletedReason,
  });

const deleteOverApi = (sessionId: string) =>
  apiFetch(`/sessions/${sessionId}`, { method: "DELETE" });

const idleSessionIdWithNotes = async () => {
  const sessionId = crypto.randomUUID();

  await idleSession(sessionId, null, scriptedPrompt([writeNotes("kept")]));

  return sessionId;
};

describe("deleting a session over the API", () => {
  it("clears the workspace object and the session object's storage, removes the registry entry, and leaves a later session alone", async () => {
    const parentId = crypto.randomUUID();
    const sessionId = await createWithNotes(parentId, "first");
    const otherSessionId = await createWithNotes(parentId, "second");

    expect((await listedFor(parentId)).map((listing) => listing.sessionId).toSorted()).toEqual(
      [sessionId, otherSessionId].toSorted(),
    );

    const response = await deleteOverApi(sessionId);

    expect(response.status).toBe(204);
    expect(await env.WorkspaceObject.getByName(sessionId).files()).toEqual([]);
    expect(await env.SessionObject.getByName(sessionId).storedTables()).toEqual([]);
    expect((await listedFor(parentId)).map((listing) => listing.sessionId)).toEqual([
      otherSessionId,
    ]);
    expect((await apiFetch(`/sessions/${sessionId}/status`)).status).toBe(404);

    expect(await env.WorkspaceObject.getByName(otherSessionId).files()).not.toEqual([]);
    expect((await apiFetch(`/sessions/${otherSessionId}/status`)).status).toBe(200);

    const laterSessionId = await createWithNotes(parentId, "later");

    expect(await env.WorkspaceObject.getByName(laterSessionId).files()).not.toEqual([]);
  });

  it("answers 404 for an id the registry does not know", async () => {
    expect((await deleteOverApi(crypto.randomUUID())).status).toBe(404);
  });

  it("answers 500 and keeps the session and its entry when the workspace cannot be destroyed, and a retry deletes them", async () => {
    const parentId = crypto.randomUUID();
    const sessionId = await createWithNotes(parentId, "kept");

    await env.WorkspaceObject.getByName(sessionId).failNextDestroy();

    expect((await deleteOverApi(sessionId)).status).toBe(500);
    expect((await listedFor(parentId)).map((listing) => listing.sessionId)).toEqual([sessionId]);
    expect(await env.SessionObject.getByName(sessionId).storedTables()).not.toEqual([]);

    expect((await deleteOverApi(sessionId)).status).toBe(204);
    expect(await listedFor(parentId)).toEqual([]);
    expect(await env.WorkspaceObject.getByName(sessionId).files()).toEqual([]);
  });
});

describe("deleting a session", () => {
  it("clears its workspace object and then its own storage, and a later setup under the same name starts empty", async () => {
    const sessionId = await idleSessionIdWithNotes();

    expect(await env.WorkspaceObject.getByName(sessionId).files()).not.toEqual([]);
    expect(await env.SessionObject.getByName(sessionId).storedTables()).not.toEqual([]);

    await deleteSessionObject(sessionId);

    expect(await env.WorkspaceObject.getByName(sessionId).files()).toEqual([]);
    expect(await env.SessionObject.getByName(sessionId).storedTables()).toEqual([]);

    await env.WorkspaceObject.getByName(sessionId).setUpWorkspace(
      workspaceInit({ context: contextEntries("fresh.md") }),
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

    await deleteSessionObject(sessionId);

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

    await deleteSessionObject(sessionId);

    expect(await env.WorkspaceObject.getByName(sessionId).files()).toEqual([]);
    expect(await env.SessionObject.getByName(sessionId).storedTables()).toEqual([]);
  });
});
