// The Workspace Worker's main module, written by hand and deployed as a Worker of its own:
// Computer's documented setup, with the mixin on the class, the two proxies exported and a Worker
// Loader binding. Alchemy bundles it from its path and never imports it in Node.
import { DurableObject } from "cloudflare:workers";

import { Workspace, WorkspaceProxy, WorkspaceServiceProxy } from "@cloudflare/computer";
import { withWorkspaceContainer } from "@cloudflare/computer/backends/container";
import { WorkerShellBackend } from "@cloudflare/computer/backends/worker-shell";
import { createGitClient } from "@cloudflare/computer/git";
import { repositoryDirectory, type WorkspaceInit } from "@tentacles/contracts/workspace";
import { readArchive } from "@tentacles/worker-api/archives";
import { archiveExpansions, type ArchiveKind } from "@tentacles/worker-api/archive-kinds";
import { InvalidWorkspace, WorkspaceUnavailable } from "@tentacles/worker-api/errors";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { githubFetch } from "./github-fetch";
import { gateway, gatewayStub } from "./workspace-gateway";
import { IdentifiedContainerBackend } from "./identified-container-backend";
import { failureReason } from "./workspace-failure";
import { previewPortHeader, workspaceContainerId, workspaceObjectClass } from "./workspace-names";
import { ContainerSettings, defaultSize, unsupportedSettings } from "./workspace-settings";

export { WorkspaceProxy, WorkspaceServiceProxy };

interface WorkspaceEnvironment {
  readonly LOADER: WorkerLoader;
  readonly TENTACLES_GITHUB_TOKEN: string;
  readonly TENTACLES_GIT_AUTHOR_NAME: string;
  readonly TENTACLES_GIT_AUTHOR_EMAIL: string;
}

const settingsKey = "tentacles.workspace";

const decodeSettings = Schema.decodeUnknownOption(ContainerSettings);

const isFailure = Schema.is(Schema.Union([InvalidWorkspace, WorkspaceUnavailable]));

/**
 * One session's workspace: Computer's workspace over this object's SQLite, the isolate shell and
 * the container, set up once at spawn. The session object reaches it by the session id.
 */
export class WorkspaceObject extends withWorkspaceContainer(
  class extends DurableObject<WorkspaceEnvironment> {},
) {
  readonly ref = { binding: workspaceObjectClass, id: this.ctx.id.toString() };

  readonly identity = {
    name: this.env.TENTACLES_GIT_AUTHOR_NAME,
    email: this.env.TENTACLES_GIT_AUTHOR_EMAIL,
  };

  // The URLs GitHub answered 404 for during a clone, which tell a missing repository from a
  // failing transport.
  readonly notFound: string[] = [];

  readonly egress = {
    mode: "http-gateway" as const,
    gateway: gatewayStub(this.ctx.exports, this.ctx.id.name ?? "unnamed"),
    revision: "v1",
  };

  readonly container = new IdentifiedContainerBackend(
    {
      id: "container",
      container: () => this,
      workspace: this.ref,
      egress: this.egress,
      name: workspaceContainerId,
      instance: this.storedSize(),
      connectTimeoutMs: 120_000,
    },
    this.identity,
  );

  readonly workspace = new Workspace({
    storage: this.ctx.storage,
    backends: [
      new WorkerShellBackend({
        id: "shell",
        loader: this.env.LOADER,
        workspace: this.ref,
        ctx: this.ctx,
      }),
      this.container,
    ],
    git: createGitClient({
      fetch: githubFetch(this.env.TENTACLES_GITHUB_TOKEN, (url) => this.notFound.push(url)),
    }),
    defaultGitIdentity: this.identity,
  });

  // The container's instance type, kept at setup so a restarted object starts the same one.
  storedSize() {
    const stored = this.ctx.storage.kv.get(settingsKey);

    return Option.match(decodeSettings(stored), {
      onNone: () => defaultSize,
      onSome: ({ size }) => size,
    });
  }

  // The shell reaches the workspace through WorkspaceServiceProxy, which calls this on the host
  // object.
  async __getWorkspaceStub() {
    await this.workspace.ready();

    return this.workspace.stub();
  }

  override async fetch(request: Request): Promise<Response> {
    const port = request.headers.get(previewPortHeader);

    if (port == null) {
      return this.container.handleFetch(request);
    }

    const url = new URL(request.url);
    const forwarded = new Request(`http://localhost${url.pathname}${url.search}`, request);

    forwarded.headers.delete(previewPortHeader);

    try {
      return await this.getWorkspaceContainer().fetchPort(Number(port), forwarded);
    } catch {
      return new Response(`Nothing answers on port ${port}`, { status: 502 });
    }
  }

  async setup(init: WorkspaceInit) {
    try {
      await this.prepare(init);
    } catch (error) {
      await this.reset(error);
    }
  }

  async prepare(init: WorkspaceInit) {
    const settings = decodeSettings({ image: init.image, size: init.size });

    if (Option.isNone(settings)) {
      throw new InvalidWorkspace({ message: unsupportedSettings(init) });
    }

    if (init.repository != null) {
      await this.clone(init.repository);
    }

    const archives: Partial<Record<ArchiveKind, Uint8Array | null>> = {
      skills: init.skills,
      context: init.context,
    };

    for (const { kind, directory } of archiveExpansions) {
      const archive = archives[kind];

      if (archive != null) {
        await this.expand(kind, directory, archive);
      }
    }

    this.ctx.storage.kv.put(settingsKey, settings.value);
  }

  async clone(repository: NonNullable<WorkspaceInit["repository"]>) {
    this.notFound.length = 0;

    try {
      await this.workspace.git.clone({
        url: repository.url,
        dir: repositoryDirectory,
        depth: repository.shallow ? 1 : 0,
        singleBranch: false,
      });
    } catch (error) {
      throw this.notFound.length > 0
        ? new InvalidWorkspace({
            message: `GitHub answered 404 for the repository ${repository.url}: it does not exist, or the deploy's token cannot read it`,
          })
        : new WorkspaceUnavailable({
            message: `Cloning ${repository.url} failed: ${String(error)}`,
          });
    }
  }

  async expand(kind: string, directory: string, archive: Uint8Array) {
    const entries = await Effect.runPromise(
      readArchive(archive).pipe(
        Effect.mapError(
          (error) =>
            new InvalidWorkspace({ message: `The ${kind} archive is invalid: ${error.message}` }),
        ),
      ),
    );

    try {
      for (const entry of entries) {
        const path = `${directory}/${entry.path}`;

        await this.workspace.fs.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
        await this.workspace.fs.writeFile(path, entry.bytes, { mode: entry.mode });
      }
    } catch (error) {
      throw new WorkspaceUnavailable({
        message: `Writing the ${kind} archive into ${directory} failed: ${String(error)}`,
      });
    }
  }

  // A failed setup leaves nothing behind: the storage is cleared and written, and the object
  // resets, so the next call builds a new Workspace over empty storage. The reset aborts the call
  // that failed, so the abort's reason carries the failure.
  async reset(cause: unknown): Promise<never> {
    const failure = isFailure(cause)
      ? cause
      : new WorkspaceUnavailable({ message: `Setting up the workspace failed: ${String(cause)}` });

    await this.clear();

    const reason = failureReason(failure);

    this.ctx.abort(reason);

    throw new Error(reason);
  }

  async clear() {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();

    // abort() discards writes not yet committed, so the deletion is flushed first.
    await this.ctx.storage.sync();
  }

  async destroy() {
    const container = this.ctx.container;

    if (container?.running === true) {
      await container.destroy();
    }

    await this.clear();

    // The Workspace in memory still believes its tables exist; dropping the instance makes the
    // next call build a fresh one over the empty storage. abort() also rejects this call.
    this.ctx.abort("workspace deleted");
  }
}

export default gateway;
