import { describe, expect, it } from "@effect/vitest";
import { ArchiveStore } from "@tentacles/contracts/archive-store";
import { Workspace } from "@tentacles/contracts/workspace";
import { SessionId } from "@tentacles/worker-api/ids";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { workspaceLayer } from "../src/workspace";
import { fakeContainer } from "./fake-container";

const sessionId = Schema.decodeSync(SessionId)("5b0c7e1a-2f4d-4c8e-9a3b-6d1e0f2a4b8c");

const identity = { name: "Deploy Author", email: "deploy@example.invalid" };

const settings = { repository: null, image: "default", size: "standard-2", lifetime: 30 } as const;

const egress: Fetcher = {
  fetch: () => Promise.resolve(new Response()),
  connect: () => {
    throw new Error("The fake egress opens no sockets");
  },
};

const archive = new Uint8Array([1, 2, 3]);

const startWorkspace = Effect.gen(function* () {
  const { container, execs, starts } = fakeContainer("workspace-image");

  const archiveStore = Layer.succeed(
    ArchiveStore,
    ArchiveStore.of({
      save: () => Effect.void,
      read: (kind) => Effect.succeed(kind === "skills" ? archive : null),
    }),
  );

  const workspace = yield* Workspace.pipe(
    Effect.provide(
      workspaceLayer({
        sessionId,
        container: () => container,
        egress,
        identity,
      }).pipe(Layer.provide(archiveStore)),
    ),
  );

  yield* workspace.ensure(settings);

  return { execs, starts };
});

describe("a workspace's start", () => {
  it.live("starts the daemon with the deploy's commit identity", () =>
    Effect.gen(function* () {
      const { execs } = yield* startWorkspace;

      const daemon = execs.find(({ command }) => command[0] === "/usr/local/bin/pi-env");

      expect(daemon?.options?.env).toEqual({
        GIT_AUTHOR_NAME: identity.name,
        GIT_AUTHOR_EMAIL: identity.email,
        GIT_COMMITTER_NAME: identity.name,
        GIT_COMMITTER_EMAIL: identity.email,
      });
    }),
  );

  it.live("expands an archive with no identity in the exec's environment", () =>
    Effect.gen(function* () {
      const { execs } = yield* startWorkspace;

      const extraction = execs.find(({ command }) => command[0] === "sh");

      expect(extraction).toBeDefined();
      expect(extraction?.options?.env).toBeUndefined();
    }),
  );

  it.live("starts the container with no identity in its environment", () =>
    Effect.gen(function* () {
      const { starts } = yield* startWorkspace;

      expect(starts).toHaveLength(1);
      expect(starts[0]?.env).toBeUndefined();
    }),
  );
});
