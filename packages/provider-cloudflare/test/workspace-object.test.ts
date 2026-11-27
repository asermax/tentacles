import { describe, expect, it } from "@effect/vitest";
import type { WorkspaceInit } from "@tentacles/contracts/workspace";
import {
  InvalidWorkspace,
  WorkspaceSetupError,
  WorkspaceUnavailable,
} from "@tentacles/worker-api/errors";
import { env } from "cloudflare:workers";
import * as Schema from "effect/Schema";

import {
  conflictingContextEntries,
  contextEntries,
  contextEntriesWithScript,
  skillEntries,
} from "./archives";
import { fixtureRepositories, fixtureRepository } from "./github-fixture";
import { testSecrets } from "./secrets";
import { workspaceInit } from "./workspace-init";

const workspaceOf = () => env.WorkspaceObject.getByName(crypto.randomUUID());

const failureOfSetup = async (workspace: ReturnType<typeof workspaceOf>, init: WorkspaceInit) => {
  const result = await workspace.setUpWorkspace(init);

  expect(result).not.toBeNull();

  return Schema.decodeUnknownSync(WorkspaceSetupError)(result);
};

describe("a workspace object's setup", () => {
  it("writes the skills and context archives into their directories with their modes", async () => {
    const workspace = workspaceOf();

    await workspace.setUpWorkspace(
      workspaceInit({
        skills: skillEntries("implement"),
        context: contextEntriesWithScript("notes.md"),
      }),
    );

    const files = await workspace.files();

    expect(files.map(({ path }) => path).toSorted()).toEqual([
      "/workspace/context/notes.md",
      "/workspace/context/run.sh",
      "/workspace/skills/implement/SKILL.md",
    ]);
    expect(files.find(({ path }) => path.endsWith("notes.md"))).toMatchObject({
      mode: 0o644,
      text: "context\n",
    });
    expect(files.find(({ path }) => path.endsWith("run.sh"))?.mode).toBe(0o755);
    expect(files.find(({ path }) => path.endsWith("SKILL.md"))?.text).toBe(
      "---\nname: implement\ndescription: The implement skill\n---\n\nFollow implement.",
    );
  });

  it("clones a readable repository into /workspace/repo", async () => {
    const workspace = workspaceOf();

    await workspace.setUpWorkspace(
      workspaceInit({ repository: fixtureRepository(fixtureRepositories.readable) }),
    );

    const files = await workspace.files();

    expect(files.find(({ path }) => path === "/workspace/repo/README.md")?.text).toBe("# app\n");
    expect(files.find(({ path }) => path === "/workspace/repo/src/index.ts")?.text).toBe("two\n");
    expect(files.some(({ path }) => path === "/workspace/repo/.git/shallow")).toBe(false);
  });

  it("clones only the latest commit when the repository is shallow", async () => {
    const workspace = workspaceOf();

    await workspace.setUpWorkspace(
      workspaceInit({ repository: fixtureRepository(fixtureRepositories.readable, true) }),
    );

    const files = await workspace.files();

    expect(files.find(({ path }) => path === "/workspace/repo/src/index.ts")?.text).toBe("two\n");
    expect(files.some(({ path }) => path === "/workspace/repo/.git/shallow")).toBe(true);
  });

  it("fails with InvalidWorkspace naming the repository GitHub answers 404 for, and leaves nothing", async () => {
    const workspace = workspaceOf();

    const failure = await failureOfSetup(
      workspace,
      workspaceInit({
        repository: fixtureRepository(fixtureRepositories.missing),
        skills: skillEntries("implement"),
      }),
    );

    expect(Schema.is(InvalidWorkspace)(failure)).toBe(true);
    expect(failure.message).toContain(fixtureRepository(fixtureRepositories.missing).url);
    expect(await workspace.files()).toEqual([]);
  });

  it("fails with WorkspaceUnavailable when an archive's files cannot be written, and clears what it already wrote", async () => {
    const workspace = workspaceOf();

    const failure = await failureOfSetup(
      workspace,
      workspaceInit({
        skills: skillEntries("implement"),
        context: conflictingContextEntries("notes.md"),
      }),
    );

    expect(Schema.is(WorkspaceUnavailable)(failure)).toBe(true);
    expect(failure.message).toContain("Writing the context archive into /workspace/context failed");
    expect(await workspace.files()).toEqual([]);
  });

  it("reports the clone's failure when an archive's files cannot be written either", async () => {
    const workspace = workspaceOf();

    const failure = await failureOfSetup(
      workspace,
      workspaceInit({
        repository: fixtureRepository(fixtureRepositories.missing),
        context: conflictingContextEntries("notes.md"),
      }),
    );

    expect(Schema.is(InvalidWorkspace)(failure)).toBe(true);
    expect(await workspace.files()).toEqual([]);
  });

  it("runs a destroy that arrives during a setup after the setup, which then leaves nothing", async () => {
    const workspace = workspaceOf();

    const setup = workspace.setUpWorkspace(
      workspaceInit({
        repository: fixtureRepository(fixtureRepositories.slow),
        context: contextEntries("notes.md"),
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    const destroy = workspace.destroy();

    await setup;
    await destroy;

    expect(await workspace.files()).toEqual([]);
  });

  it("fails with InvalidWorkspace for an image or size the deploy does not offer", async () => {
    const workspace = workspaceOf();

    const failure = await failureOfSetup(
      workspace,
      workspaceInit({ size: "huge", image: "custom" }),
    );

    expect(Schema.is(InvalidWorkspace)(failure)).toBe(true);
    expect(failure.message).toContain('image "custom"');
    expect(failure.message).toContain('size "huge"');
  });

  it("fails with WorkspaceUnavailable when GitHub does not answer, and leaves nothing", async () => {
    const workspace = workspaceOf();

    const failure = await failureOfSetup(
      workspace,
      workspaceInit({ repository: fixtureRepository(fixtureRepositories.unreachable) }),
    );

    expect(Schema.is(WorkspaceUnavailable)(failure)).toBe(true);
    expect(failure.message).toContain(fixtureRepository(fixtureRepositories.unreachable).url);
    expect(await workspace.files()).toEqual([]);
  });
});

describe("a workspace object's container", () => {
  it("is requested at the instance size the setup stored", async () => {
    const workspace = workspaceOf();

    await workspace.setUpWorkspace(workspaceInit({ size: "standard-2" }));

    expect(await workspace.requestedInstances()).toEqual(["standard-2"]);
  });

  it("is requested at the default instance size before any setup stored one", async () => {
    expect(await workspaceOf().requestedInstances()).toEqual(["basic"]);
  });
});

describe("a workspace object's container commands", () => {
  it("run with the deploy's git identity and the interception CA for Node, after the caller's variables", async () => {
    const environment = await workspaceOf().containerExecEnvironment({
      CALLER_VARIABLE: "kept",
      GIT_AUTHOR_NAME: "Someone Else",
      NODE_EXTRA_CA_CERTS: "/tmp/other.crt",
    });

    expect(environment).toEqual({
      CALLER_VARIABLE: "kept",
      GIT_AUTHOR_NAME: testSecrets.TENTACLES_GIT_AUTHOR_NAME,
      GIT_AUTHOR_EMAIL: testSecrets.TENTACLES_GIT_AUTHOR_EMAIL,
      GIT_COMMITTER_NAME: testSecrets.TENTACLES_GIT_AUTHOR_NAME,
      GIT_COMMITTER_EMAIL: testSecrets.TENTACLES_GIT_AUTHOR_EMAIL,
      NODE_EXTRA_CA_CERTS: "/usr/local/share/ca-certificates/cloudflare-containers-ca.crt",
    });
  });
});

describe("a workspace object's destroy", () => {
  it("clears its files", async () => {
    const workspace = workspaceOf();

    await workspace.setUpWorkspace(workspaceInit({ context: contextEntries("old.md") }));

    expect(await workspace.files()).not.toEqual([]);

    await workspace.destroy();

    expect(await workspace.files()).toEqual([]);
  });
});
