import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, readlinkSync } from "node:fs";
import { dirname, join } from "node:path";

import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { Connection, localDaemon, RemoteExecutionEnv } from "@earendil-works/pi-env";
import {
  Workspace,
  type WorkspaceSettings,
  WorkspaceUnavailable,
} from "@tentacles/contracts/workspace";
import type { Repository } from "@tentacles/worker-api/settings";
import * as Effect from "effect/Effect";

/** What the test reads back from one session's workspace. */
export interface WorkspaceRecord {
  /** Every ensure call, with its settings. */
  readonly ensures: WorkspaceSettings[];
  /** The host directory mounted at /workspace. */
  readonly directory: string;
  /** Answers Workspace.forward. */
  forward: (port: number, request: Request) => Response;
}

// Distributions point /lib64 at different places (usr/lib on Arch, usr/lib64
// on Ubuntu), and the dynamic loader's path goes through it, so the sandbox
// repeats the host's own links instead of assuming one layout.
const mergedUsrLinks = ["/bin", "/lib", "/lib64"]
  .filter((path) => lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink() === true)
  .flatMap((path) => ["--symlink", readlinkSync(path), path]);

// pi-env's published daemon, run locally in a bubblewrap sandbox whose
// /workspace is the session's directory, so tools see the paths a container
// gives them. `shared` holds the bare remotes and stays at its own path.
const sandboxed = (directory: string, shared: string) => {
  const daemon = localDaemon();

  return [
    "bwrap",
    "--ro-bind",
    "/usr",
    "/usr",
    ...mergedUsrLinks,
    "--ro-bind",
    "/etc",
    "/etc",
    "--proc",
    "/proc",
    "--dev",
    "/dev",
    "--tmpfs",
    "/tmp",
    "--bind",
    directory,
    "/workspace",
    "--bind",
    shared,
    shared,
    "--ro-bind",
    dirname(daemon),
    dirname(daemon),
    "--setenv",
    "HOME",
    "/tmp",
    "--setenv",
    "GIT_AUTHOR_NAME",
    "agent",
    "--setenv",
    "GIT_AUTHOR_EMAIL",
    "agent@tentacles.test",
    "--setenv",
    "GIT_COMMITTER_NAME",
    "agent",
    "--setenv",
    "GIT_COMMITTER_EMAIL",
    "agent@tentacles.test",
    "--die-with-parent",
    daemon,
  ];
};

/**
 * A session's Workspace over a local sandboxed daemon. ensure starts the
 * workspace on its first call and clones the repository then, as a container
 * that just started would; a failed clone leaves it not started.
 */
export const testWorkspace = (root: string, shared: string) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const directory = join(root, "workspace");

      mkdirSync(directory, { recursive: true });

      const record: WorkspaceRecord = {
        ensures: [],
        directory,
        forward: () => new Response("no app", { status: 502 }),
      };

      return {
        record,
        connection: new Connection({ command: sandboxed(directory, shared) }),
      };
    }),
    ({ connection }) => Effect.sync(() => connection.close()),
  ).pipe(
    Effect.map(({ record, connection }) => {
      let isStarted = false;

      const clone = (repository: Repository) =>
        Effect.promise(async () => {
          const env = new RemoteExecutionEnv({ connection, id: "clone", cwd: "/" });
          const depth = repository.shallow ? ["--depth", "1"] : [];
          let output = "";

          const result = await env.exec(
            ["git", "clone", ...depth, repository.url, "/workspace"],
            { onOutput: (text) => (output += text) },
            BACKGROUND_CONTEXT,
          );

          return result.ok && result.value.exitCode === 0 ? null : output;
        }).pipe(
          Effect.flatMap((failure) =>
            failure == null
              ? Effect.void
              : Effect.fail(new WorkspaceUnavailable({ message: `git clone failed: ${failure}` })),
          ),
        );

      const workspace = Workspace.of({
        ensure: (settings) =>
          Effect.gen(function* () {
            record.ensures.push(settings);

            if (isStarted) {
              return;
            }

            if (settings.repository != null) {
              yield* clone(settings.repository);
            }

            isStarted = true;
          }),
        connection: () => Effect.succeed(connection),
        forward: (port, request) => Effect.sync(() => record.forward(port, request)),
        isRunning: () => Effect.sync(() => isStarted),
      });

      return { record, workspace };
    }),
  );

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.name=seed", "-c", "user.email=seed@tentacles.test", ...args], {
    cwd,
    stdio: "ignore",
  });

/** A bare repository with one commit on main, the remote a session clones. */
export const bareRepository = (shared: string, name: string) => {
  const bare = join(shared, `${name}.git`);
  const seed = join(shared, `${name}-seed`);

  git(shared, "init", "--bare", "-b", "main", bare);
  git(shared, "init", "-b", "main", seed);
  execFileSync("sh", ["-c", "echo '# app' > README.md"], { cwd: seed });
  git(seed, "add", ".");
  git(seed, "commit", "-m", "initial");
  git(seed, "push", bare, "main");

  return bare;
};
