import { describe, expect, it } from "@effect/vitest";
import type { WorkspaceInit } from "@tentacles/contracts/workspace";
import { InvalidWorkspace, WorkspaceUnavailable } from "@tentacles/worker-api/errors";
import { env } from "cloudflare:workers";
import * as Schema from "effect/Schema";

import { failureOf } from "../src/workspace-failure";
import { contextArchive, skillsArchive } from "./archives";
import { fixtureRepositories } from "./github-fixture";

const init = (overrides: Partial<WorkspaceInit> = {}): WorkspaceInit => ({
  repository: null,
  image: "default",
  size: "basic",
  skills: null,
  context: null,
  ...overrides,
});

const repository = (path: string, shallow = false) => ({
  url: `https://github.com/${path}.git`,
  shallow,
});

// A workspace object that resets itself breaks the stub that called it, so a test reaches the
// object again by its name.
const workspaceOf = () => {
  const name = crypto.randomUUID();

  return () => env.WorkspaceObject.getByName(name);
};

const failureOfSetup = async (
  workspace: ReturnType<typeof workspaceOf>,
  request: WorkspaceInit,
) => {
  const error = await workspace()
    .setup(request)
    .then(
      () => null,
      (cause: unknown) => cause,
    );

  expect(error).not.toBeNull();

  return failureOf(error);
};

describe("a workspace object's setup", () => {
  it("writes the skills and context archives into their directories with their modes", async () => {
    const workspace = workspaceOf();

    await workspace().setup(
      init({
        skills: await skillsArchive("implement"),
        context: await contextArchive("notes.md"),
      }),
    );

    const files = await workspace().files();

    expect(files.map(({ path }) => path).toSorted()).toEqual([
      "/workspace/context/notes.md",
      "/workspace/skills/implement/SKILL.md",
    ]);
    expect(files.find(({ path }) => path.endsWith("notes.md"))).toMatchObject({
      mode: 0o644,
      text: "context\n",
    });
  });

  it("clones a readable repository into /workspace/repo", async () => {
    const workspace = workspaceOf();

    await workspace().setup(init({ repository: repository(fixtureRepositories.readable) }));

    const files = await workspace().files();

    expect(files.find(({ path }) => path === "/workspace/repo/README.md")?.text).toBe("# app\n");
    expect(files.find(({ path }) => path === "/workspace/repo/src/index.ts")?.text).toBe("two\n");
    expect(files.some(({ path }) => path === "/workspace/repo/.git/shallow")).toBe(false);
  });

  it("clones only the latest commit when the repository is shallow", async () => {
    const workspace = workspaceOf();

    await workspace().setup(init({ repository: repository(fixtureRepositories.readable, true) }));

    const files = await workspace().files();

    expect(files.find(({ path }) => path === "/workspace/repo/src/index.ts")?.text).toBe("two\n");
    expect(files.some(({ path }) => path === "/workspace/repo/.git/shallow")).toBe(true);
  });

  it("fails with InvalidWorkspace naming the repository GitHub answers 404 for, and leaves nothing", async () => {
    const workspace = workspaceOf();

    const failure = await failureOfSetup(
      workspace,
      init({
        repository: repository(fixtureRepositories.missing),
        skills: await skillsArchive("implement"),
      }),
    );

    expect(Schema.is(InvalidWorkspace)(failure)).toBe(true);
    expect(failure.message).toContain(repository(fixtureRepositories.missing).url);
    expect(await workspace().files()).toEqual([]);
  });

  it("fails with InvalidWorkspace for an archive that is not a tar.gz, and clears what it already wrote", async () => {
    const workspace = workspaceOf();

    const failure = await failureOfSetup(
      workspace,
      init({
        skills: await skillsArchive("implement"),
        context: new TextEncoder().encode("not an archive"),
      }),
    );

    expect(Schema.is(InvalidWorkspace)(failure)).toBe(true);
    expect(failure.message).toContain("The context archive is invalid");
    expect(await workspace().files()).toEqual([]);
  });

  it("fails with InvalidWorkspace for an image or size the deploy does not offer", async () => {
    const workspace = workspaceOf();

    const failure = await failureOfSetup(workspace, init({ size: "huge", image: "custom" }));

    expect(Schema.is(InvalidWorkspace)(failure)).toBe(true);
    expect(failure.message).toContain('image "custom"');
    expect(failure.message).toContain('size "huge"');
  });

  it("fails with WorkspaceUnavailable when GitHub does not answer, and leaves nothing", async () => {
    const workspace = workspaceOf();

    const failure = await failureOfSetup(
      workspace,
      init({ repository: repository(fixtureRepositories.unreachable) }),
    );

    expect(Schema.is(WorkspaceUnavailable)(failure)).toBe(true);
    expect(await workspace().files()).toEqual([]);
  });
});

describe("a workspace object's destroy", () => {
  it("clears its files, so a later setup under the same name starts empty", async () => {
    const id = crypto.randomUUID();

    await env.WorkspaceObject.getByName(id).setup(
      init({ context: await contextArchive("old.md") }),
    );
    await env.WorkspaceObject.getByName(id)
      .destroy()
      .catch(() => undefined);

    expect(await env.WorkspaceObject.getByName(id).files()).toEqual([]);

    await env.WorkspaceObject.getByName(id).setup(
      init({ context: await contextArchive("new.md") }),
    );

    expect((await env.WorkspaceObject.getByName(id).files()).map(({ path }) => path)).toEqual([
      "/workspace/context/new.md",
    ]);
  });
});
