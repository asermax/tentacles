import { describe, expect, it } from "@effect/vitest";
import { InvalidArchive } from "@tentacles/worker-api/errors";
import { SessionId } from "@tentacles/worker-api/ids";
import { env } from "cloudflare:workers";
import * as Schema from "effect/Schema";

import { agentsArchive, contextArchive, skillsArchive } from "./archives";
import { apiFetch, testSettings, waitUntilIdle } from "./sessions";

const withinLimit = 5_200_000;
const overLimit = 5_300_000;

const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

interface Archives {
  skills?: Uint8Array;
  agents?: Uint8Array;
  context?: Uint8Array;
}

// JSON.stringify leaves out the archives that are undefined.
const createBody = (parentId: string, archives: Archives) =>
  JSON.stringify({
    name: "worker",
    parent: { harness: "pi", sessionId: parentId },
    prompt: "Say done.",
    settings: testSettings,
    skills: archives.skills == null ? undefined : base64(archives.skills),
    agents: archives.agents == null ? undefined : base64(archives.agents),
    context: archives.context == null ? undefined : base64(archives.context),
  });

const create = (parentId: string, archives: Archives = {}) =>
  apiFetch("/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: createBody(parentId, archives),
  });

const decodeCreated = Schema.decodeUnknownSync(Schema.Struct({ sessionId: SessionId }));

const decodeInvalidArchive = Schema.decodeUnknownSync(InvalidArchive);

const list = async (parentId: string) => {
  const response = await apiFetch(`/sessions?harness=pi&sessionId=${parentId}`);

  return response.json();
};

describe("create through the Worker", () => {
  it("stores the skills archive it received, as the same bytes, in the session object", async () => {
    const parentId = crypto.randomUUID();
    const skills = await skillsArchive("implement", withinLimit);

    const response = await create(parentId, { skills });
    const { sessionId } = decodeCreated(await response.json());

    expect(response.status).toBe(200);
    expect(skills.byteLength).toBeGreaterThan(5_000_000);

    const stored = await env.SessionObject.getByName(sessionId).storedArchive("skills");

    expect(stored).toEqual(skills);

    await waitUntilIdle(sessionId);
  });

  it("answers 400 InvalidArchive with its message for an archive that is not a tar.gz, and stores nothing", async () => {
    const parentId = crypto.randomUUID();

    const response = await create(parentId, { skills: new TextEncoder().encode("not an archive") });

    expect(response.status).toBe(400);
    expect(decodeInvalidArchive(await response.json()).message).toContain(
      "The skills archive is invalid: it is not a readable tar.gz",
    );
    expect(await list(parentId)).toEqual([]);
  });

  it("answers 400 for a skills archive over the limit, with no registry entry", async () => {
    const parentId = crypto.randomUUID();
    const skills = await skillsArchive("bulky", overLimit);

    const response = await create(parentId, { skills });

    expect(response.status).toBe(400);
    expect(await list(parentId)).toEqual([]);
  });

  it("stores the context archive it received, as the same bytes, next to the skills archive", async () => {
    const parentId = crypto.randomUUID();
    const skills = await skillsArchive("implement");
    const context = await contextArchive("notes.md");

    const response = await create(parentId, { skills, context });
    const { sessionId } = decodeCreated(await response.json());
    const session = env.SessionObject.getByName(sessionId);

    expect(response.status).toBe(200);
    expect(await session.storedArchive("context")).toEqual(context);
    expect(await session.storedArchive("skills")).toEqual(skills);

    await waitUntilIdle(sessionId);
  });

  it("stores no context archive for a create without context", async () => {
    const response = await create(crypto.randomUUID());
    const { sessionId } = decodeCreated(await response.json());

    expect(await env.SessionObject.getByName(sessionId).storedArchive("context")).toBeNull();

    await waitUntilIdle(sessionId);
  });

  it("answers 400 for a context archive over the limit, with no registry entry", async () => {
    const parentId = crypto.randomUUID();
    const context = await contextArchive("bulky.bin", overLimit);

    const response = await create(parentId, { context });

    expect(response.status).toBe(400);
    expect(await list(parentId)).toEqual([]);
  });

  it("answers 400 InvalidArchive naming the context archive for one that is not a tar.gz", async () => {
    const parentId = crypto.randomUUID();

    const response = await create(parentId, {
      context: new TextEncoder().encode("not an archive"),
    });

    expect(response.status).toBe(400);
    expect(decodeInvalidArchive(await response.json()).message).toContain(
      "The context archive is invalid: it is not a readable tar.gz",
    );
    expect(await list(parentId)).toEqual([]);
  });
});

describe("list through the Worker", () => {
  it("carries the settings and the skill and agent names of a session created with both archives", async () => {
    const parentId = crypto.randomUUID();

    const response = await create(parentId, {
      skills: await skillsArchive("implement"),
      agents: await agentsArchive("reviewer"),
    });

    const { sessionId } = decodeCreated(await response.json());

    await waitUntilIdle(sessionId);

    expect(await list(parentId)).toEqual([
      {
        sessionId,
        name: "worker",
        status: "idle",
        settings: testSettings,
        skills: ["implement"],
        agents: ["reviewer"],
      },
    ]);
  });

  it("carries the settings and two empty name lists for a session created with no archives", async () => {
    const parentId = crypto.randomUUID();

    const response = await create(parentId);
    const { sessionId } = decodeCreated(await response.json());

    await waitUntilIdle(sessionId);

    expect(await list(parentId)).toEqual([
      {
        sessionId,
        name: "worker",
        status: "idle",
        settings: testSettings,
        skills: [],
        agents: [],
      },
    ]);
  });
});
