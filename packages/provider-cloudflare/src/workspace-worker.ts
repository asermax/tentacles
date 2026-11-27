// The Workspace Worker's main module, written by hand and deployed as a Worker of its own:
// Computer's documented setup, with the mixin on the class, the two proxies exported and a Worker
// Loader binding. Alchemy bundles it from its path and never imports it in Node.
import { DurableObject } from "cloudflare:workers";
import { dirname } from "node:path/posix";

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
import { gateway, gatewayStub, type GatewayEnvironment } from "./workspace-gateway";
import { IdentifiedContainerBackend } from "./identified-container-backend";
import { sizedContainerHolder } from "./sized-container-host";
import { destroyedReason, failureReason, isWorkspaceFailure } from "./workspace-failure";
import {
  previewPortHeader,
  workspaceBackends,
  workspaceContainerId,
  workspaceObjectClass,
} from "./workspace-names";
import { ContainerSettings, defaultSize, unsupportedSettingsMessage } from "./workspace-settings";

export { WorkspaceProxy, WorkspaceServiceProxy };

interface WorkspaceEnvironment extends GatewayEnvironment {
  readonly LOADER: WorkerLoader;
  readonly TENTACLES_GIT_AUTHOR_NAME: string;
  readonly TENTACLES_GIT_AUTHOR_EMAIL: string;
}

const containerSettingsKey = "tentacles.workspace";

const decodeContainerSettings = Schema.decodeUnknownOption(ContainerSettings);

/**
 * One session's workspace: Computer's workspace over this object's SQLite, the isolate shell and
 * the container, set up once at spawn. The session object reaches it by the session id.
 */
export class WorkspaceObject extends withWorkspaceContainer(
  class extends DurableObject<WorkspaceEnvironment> {},
) {
  readonly workspaceRef = { binding: workspaceObjectClass, id: this.ctx.id.toString() };

  readonly gitIdentity = {
    name: this.env.TENTACLES_GIT_AUTHOR_NAME,
    email: this.env.TENTACLES_GIT_AUTHOR_EMAIL,
  };

  // Whether GitHub answered 404 during a clone, which tells a missing repository from a failing
  // transport.
  #hasNotFoundResponse = false;

  readonly containerBackend = new IdentifiedContainerBackend(
    {
      id: workspaceBackends.container,
      container: () => sizedContainerHolder(this, () => this.#readStoredSize()),
      workspace: this.workspaceRef,
      egress: {
        mode: "http-gateway" as const,
        gateway: gatewayStub(this.ctx.exports),
        revision: "v1",
      },
      name: workspaceContainerId,
      connectTimeoutMs: 120_000,
    },
    this.gitIdentity,
  );

  readonly workspace = new Workspace({
    storage: this.ctx.storage,
    backends: [
      new WorkerShellBackend({
        id: workspaceBackends.shell,
        loader: this.env.LOADER,
        workspace: this.workspaceRef,
        ctx: this.ctx,
      }),
      this.containerBackend,
    ],
    git: createGitClient({
      fetch: githubFetch(this.env.TENTACLES_GITHUB_TOKEN, () => {
        this.#hasNotFoundResponse = true;
      }),
    }),
    defaultGitIdentity: this.gitIdentity,
  });

  // The container's instance type, kept at setup. The container backend reads it each time it starts
  // a container, so a session's first container and one after a restart get the size it asked for.
  #readStoredSize() {
    const storedSettings = this.ctx.storage.kv.get(containerSettingsKey);

    return Option.match(decodeContainerSettings(storedSettings), {
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
      return this.containerBackend.handleFetch(request);
    }

    const url = new URL(request.url);
    const forwardedRequest = new Request(`http://localhost${url.pathname}${url.search}`, request);

    forwardedRequest.headers.delete(previewPortHeader);

    try {
      return await this.getWorkspaceContainer().fetchPort(Number(port), forwardedRequest);
    } catch {
      return new Response(`Nothing answers on port ${port}`, { status: 502 });
    }
  }

  async setup(init: WorkspaceInit) {
    try {
      await this.#populateWorkspace(init);
    } catch (error) {
      await this.#resetAfterFailedSetup(error);
    }
  }

  async #populateWorkspace(init: WorkspaceInit) {
    const containerSettings = decodeContainerSettings({ image: init.image, size: init.size });

    if (Option.isNone(containerSettings)) {
      throw new InvalidWorkspace({ message: unsupportedSettingsMessage(init) });
    }

    if (init.repository != null) {
      await this.#cloneRepository(init.repository);
    } else {
      await this.workspace.fs.mkdir(repositoryDirectory, { recursive: true });
    }

    const archivesByKind: Partial<Record<ArchiveKind, Uint8Array | null>> = {
      skills: init.skills,
      context: init.context,
    };

    for (const { kind, directory } of archiveExpansions) {
      await this.workspace.fs.mkdir(directory, { recursive: true });

      const archive = archivesByKind[kind];

      if (archive != null) {
        await this.#expandArchive(kind, directory, archive);
      }
    }

    this.ctx.storage.kv.put(containerSettingsKey, containerSettings.value);
  }

  async #cloneRepository(repository: NonNullable<WorkspaceInit["repository"]>) {
    this.#hasNotFoundResponse = false;

    try {
      await this.workspace.git.clone({
        url: repository.url,
        dir: repositoryDirectory,
        depth: repository.shallow ? 1 : 0,
        singleBranch: false,
      });
    } catch (error) {
      throw this.#hasNotFoundResponse
        ? new InvalidWorkspace({
            message: `GitHub answered 404 for the repository ${repository.url}: it does not exist, or the deploy's token cannot read it`,
          })
        : new WorkspaceUnavailable({
            message: `Cloning ${repository.url} failed: ${String(error)}`,
          });
    }
  }

  async #expandArchive(kind: ArchiveKind, directory: string, archive: Uint8Array) {
    const archiveEntries = await Effect.runPromise(
      readArchive(archive).pipe(
        Effect.mapError(
          (error) =>
            new InvalidWorkspace({ message: `The ${kind} archive is invalid: ${error.message}` }),
        ),
      ),
    );

    try {
      const archiveFiles = archiveEntries.map((entry) => ({
        entry,
        path: `${directory}/${entry.path}`,
      }));

      for (const parentDirectory of new Set(archiveFiles.map(({ path }) => dirname(path)))) {
        await this.workspace.fs.mkdir(parentDirectory, { recursive: true });
      }

      for (const { entry, path } of archiveFiles) {
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
  async #resetAfterFailedSetup(cause: unknown): Promise<never> {
    const failure = isWorkspaceFailure(cause)
      ? cause
      : new WorkspaceUnavailable({ message: `Setting up the workspace failed: ${String(cause)}` });

    await this.#clearStorage();

    const abortReason = failureReason(failure);

    this.ctx.abort(abortReason);

    throw new Error(abortReason);
  }

  async #clearStorage() {
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

    await this.#clearStorage();

    // The Workspace in memory still believes its tables exist; dropping the instance makes the
    // next call build a fresh one over the empty storage. abort() also rejects this call.
    this.ctx.abort(destroyedReason);
  }
}

export default gateway;
