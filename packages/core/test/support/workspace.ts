import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, readlinkSync } from "node:fs";
import { dirname, join } from "node:path";

import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { Connection, localDaemon, RemoteExecutionEnv } from "@earendil-works/pi-env";
import type { SkillsArchive } from "@tentacles/contracts/skills-archive";
import {
  skillsDirectory,
  Workspace,
  type WorkspaceSettings,
  WorkspaceUnavailable,
} from "@tentacles/contracts/workspace";
import type { Repository } from "@tentacles/worker-api/settings";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

/** What the test reads back from one session's workspace. */
export interface WorkspaceRecord {
  /** Every ensure call, with its settings. */
  readonly ensures: WorkspaceSettings[];
  /** The host directory mounted at /workspace. */
  readonly directory: string;
  /** Answers Workspace.forward. */
  forward: (port: number, request: Request) => Response;
}

// Repository URLs must be https, so the bare remotes are named by this host
// and the sandbox's git rewrites it to the directory that holds them.
const remoteHost = "https://git.test/";

/** The URL a session's settings use for a bare remote created by bareRepository. */
export const remoteUrl = (name: string) => `${remoteHost}${name}.git`;

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
    "GIT_CONFIG_COUNT",
    "1",
    "--setenv",
    "GIT_CONFIG_KEY_0",
    `url.${shared}/.insteadOf`,
    "--setenv",
    "GIT_CONFIG_VALUE_0",
    remoteHost,
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

const archivePath = "/tmp/skills.tar.gz";

/**
 * A session's Workspace over a local sandboxed daemon. ensure starts the
 * workspace on its first call, clones the repository and expands the skills
 * archive into /skills then, as a container that just started would; a failed
 * clone or expansion leaves it not started.
 */
export const testWorkspace = (
  root: string,
  shared: string,
  skillsArchive: SkillsArchive["Service"],
) =>
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

      // pi-env's exec takes no standard input, so the archive goes in as a file.
      const extractSkills = (archive: Uint8Array) =>
        Effect.promise(async () => {
          const env = new RemoteExecutionEnv({ connection, id: "skills", cwd: "/" });
          const written = await env.writeFile(archivePath, archive, BACKGROUND_CONTEXT);

          if (!written.ok) {
            return String(written.error);
          }

          let output = "";

          const result = await env.exec(
            [
              "sh",
              "-c",
              `mkdir -p ${skillsDirectory} && tar -xzf ${archivePath} -C ${skillsDirectory}`,
            ],
            { onOutput: (text) => (output += text) },
            BACKGROUND_CONTEXT,
          );

          return result.ok && result.value.exitCode === 0 ? null : output;
        }).pipe(
          Effect.flatMap((failure) =>
            failure == null
              ? Effect.void
              : Effect.fail(
                  new WorkspaceUnavailable({ message: `Expanding the skills failed: ${failure}` }),
                ),
          ),
        );

      const workspace = Workspace.of({
        ensure: (settings) =>
          Effect.gen(function* () {
            record.ensures.push(settings);

            if (isStarted) {
              return;
            }

            yield* Effect.all(
              [
                Effect.result(
                  settings.repository == null ? Effect.void : clone(settings.repository),
                ),
                Effect.result(
                  Effect.flatMap(skillsArchive.read(), (archive) =>
                    archive == null ? Effect.void : extractSkills(archive),
                  ),
                ),
              ],
              { concurrency: 2 },
            ).pipe(
              Effect.flatMap((results) => {
                const messages = results.flatMap((result) =>
                  Result.isFailure(result) ? [result.failure.message] : [],
                );

                return messages.length === 0
                  ? Effect.void
                  : Effect.fail(new WorkspaceUnavailable({ message: messages.join("; ") }));
              }),
            );

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

/** A bare repository with one commit on main; returns the URL a session clones it from. */
export const bareRepository = (shared: string, name: string) => {
  const bare = join(shared, `${name}.git`);
  const seed = join(shared, `${name}-seed`);

  git(shared, "init", "--bare", "-b", "main", bare);
  git(shared, "init", "-b", "main", seed);
  execFileSync("sh", ["-c", "echo '# app' > README.md"], { cwd: seed });
  git(seed, "add", ".");
  git(seed, "commit", "-m", "initial");
  git(seed, "push", bare, "main");

  return remoteUrl(name);
};
