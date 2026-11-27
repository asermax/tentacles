import { describe, expect, it } from "@effect/vitest";
import {
  InvalidArchive,
  InvalidWorkspace,
  WorkspaceUnavailable,
} from "@tentacles/worker-api/errors";
import { SessionId } from "@tentacles/worker-api/ids";
import type { Settings } from "@tentacles/worker-api/settings";
import { env } from "cloudflare:workers";
import * as Schema from "effect/Schema";

import { agentsArchive, contextArchive, skillsArchive } from "./archives";
import { fixtureRepositories } from "./github-fixture";
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
const createBody = (parentId: string, archives: Archives, settings: Settings) =>
  JSON.stringify({
    name: "worker",
    parent: { harness: "pi", sessionId: parentId },
    prompt: "Say done.",
    settings,
    skills: archives.skills == null ? undefined : base64(archives.skills),
    agents: archives.agents == null ? undefined : base64(archives.agents),
    context: archives.context == null ? undefined : base64(archives.context),
  });

const create = (parentId: string, archives: Archives = {}, settings: Settings = testSettings) =>
  apiFetch("/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: createBody(parentId, archives, settings),
  });

const decodeCreated = Schema.decodeUnknownSync(Schema.Struct({ sessionId: SessionId }));

const decodeInvalidArchive = Schema.decodeUnknownSync(InvalidArchive);

const decodeInvalidWorkspace = Schema.decodeUnknownSync(InvalidWorkspace);

const decodeWorkspaceUnavailable = Schema.decodeUnknownSync(WorkspaceUnavailable);

const withRepository = (path: string) => ({
  ...testSettings,
  repository: { url: `https://github.com/${path}.git`, shallow: true },
});

const decodeEntries = Schema.decodeUnknownSync(
  Schema.Array(Schema.Struct({ sessionId: Schema.String, status: Schema.String })),
);

const failedEntries = async (parentId: string) => decodeEntries(await list(parentId));

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

    const files = await env.WorkspaceObject.getByName(sessionId).files();

    expect(files.find(({ path }) => path === "/workspace/skills/implement/SKILL.md")).toBeDefined();
    expect(files.find(({ path }) => path === "/workspace/skills/implement/filler.bin")?.size).toBe(
      withinLimit,
    );

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
    const files = await env.WorkspaceObject.getByName(sessionId).files();

    expect(response.status).toBe(200);
    expect(files.map(({ path }) => path).toSorted()).toEqual([
      "/workspace/context/notes.md",
      "/workspace/skills/implement/SKILL.md",
    ]);

    await waitUntilIdle(sessionId);
  });

  it("stores no context archive for a create without context", async () => {
    const response = await create(crypto.randomUUID());
    const { sessionId } = decodeCreated(await response.json());

    expect(await env.WorkspaceObject.getByName(sessionId).files()).toEqual([]);

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

describe("create through the Worker with a repository", () => {
  it("clones a readable repository into /workspace/repo", async () => {
    const response = await create(
      crypto.randomUUID(),
      {},
      withRepository(fixtureRepositories.readable),
    );

    const { sessionId } = decodeCreated(await response.json());
    const files = await env.WorkspaceObject.getByName(sessionId).files();

    expect(response.status).toBe(200);
    expect(files.find(({ path }) => path === "/workspace/repo/README.md")?.text).toBe("# app\n");
    expect(files.some(({ path }) => path === "/workspace/repo/.git/shallow")).toBe(true);

    await waitUntilIdle(sessionId);
  });

  it("answers 400 InvalidWorkspace naming a repository GitHub answers 404 for, and lists the session as failed", async () => {
    const parentId = crypto.randomUUID();

    const response = await create(parentId, {}, withRepository(fixtureRepositories.missing));

    expect(response.status).toBe(400);
    expect(decodeInvalidWorkspace(await response.json()).message).toContain(
      "https://github.com/acme/missing.git",
    );

    const [entry] = await failedEntries(parentId);

    expect(entry?.status).toBe("failed");
    expect(await env.WorkspaceObject.getByName(entry?.sessionId ?? "").files()).toEqual([]);
  });

  it("answers 400 InvalidWorkspace naming the image and size the deploy does not offer", async () => {
    const response = await create(crypto.randomUUID(), {}, { ...testSettings, size: "huge" });

    expect(response.status).toBe(400);

    const { message } = decodeInvalidWorkspace(await response.json());

    expect(message).toContain('image "default"');
    expect(message).toContain('size "huge"');
  });

  it("answers 500 WorkspaceUnavailable when GitHub does not answer, and leaves the workspace empty", async () => {
    const parentId = crypto.randomUUID();

    const response = await create(parentId, {}, withRepository(fixtureRepositories.unreachable));

    expect(response.status).toBe(500);
    expect(decodeWorkspaceUnavailable(await response.json()).message).toContain(
      "https://github.com/acme/unreachable.git",
    );

    const [entry] = await failedEntries(parentId);

    expect(await env.WorkspaceObject.getByName(entry?.sessionId ?? "").files()).toEqual([]);
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
