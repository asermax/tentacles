import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { githubHost } from "../src/github-fetch";
import { echo } from "./echo";

/**
 * The repositories the fixture answers for, by their path under github.com. `slow` is the readable
 * repository with every request answered half a second late.
 */
export const fixtureRepositories = {
  readable: "acme/app",
  missing: "acme/missing",
  unreachable: "acme/unreachable",
  slow: "acme/slow",
} as const;

const slowRepositoryDelayMillis = 500;

/** A repository of the fixture as a clone's repository setting. */
export const fixtureRepository = (repositoryPath: string, isShallow = false) => ({
  url: `https://github.com/${repositoryPath}.git`,
  shallow: isShallow,
});

const runGit = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.name=seed", "-c", "user.email=seed@tentacles.test", ...args], {
    cwd,
    stdio: "ignore",
  });

// A bare repository with two commits on main, so a depth-1 clone leaves its history shallow.
const seedRepository = () => {
  const root = mkdtempSync(join(tmpdir(), "tentacles-github-"));
  const bareRepositoryPath = join(root, "app.git");
  const seed = join(root, "seed");

  mkdirSync(join(seed, "src"), { recursive: true });
  runGit(root, "init", "--bare", "-b", "main", bareRepositoryPath);
  runGit(seed, "init", "-b", "main");
  writeFileSync(join(seed, "README.md"), "# app\n");
  writeFileSync(join(seed, "src/index.ts"), "one\n");
  runGit(seed, "add", ".");
  runGit(seed, "commit", "-m", "first");
  writeFileSync(join(seed, "src/index.ts"), "two\n");
  runGit(seed, "commit", "-am", "second");
  runGit(seed, "push", bareRepositoryPath, "main");

  return bareRepositoryPath;
};

const pktLine = (text: string) => `${(text.length + 4).toString(16).padStart(4, "0")}${text}`;

const advertisementContentType = "application/x-git-upload-pack-advertisement";

const uploadResultContentType = "application/x-git-upload-pack-result";

const runUploadPack = (
  bareRepositoryPath: string,
  requestBody: Uint8Array | undefined,
  ...args: string[]
) =>
  spawnSync("git", ["upload-pack", "--stateless-rpc", ...args, bareRepositoryPath], {
    input: requestBody,
    maxBuffer: 64 * 1024 * 1024,
  }).stdout;

/**
 * What the Workspace Worker's outbound requests reach in the tests: GitHub's smart HTTP protocol
 * for the fixture repositories, served by git's own upload-pack, and every other request answered
 * with what it carried. `unreachable` makes the request throw, as a network that is down does.
 */
export const githubFixture = () => {
  let seededRepositoryPath: string | undefined;

  const bareRepositoryPath = () => {
    seededRepositoryPath ??= seedRepository();

    return seededRepositoryPath;
  };

  return async (request: Request) => {
    const url = new URL(request.url);

    if (url.hostname !== githubHost) {
      return echo(request);
    }

    const [owner, name] = url.pathname.split("/").slice(1);
    const repository = `${owner}/${name?.replace(/\.git$/, "")}`;

    if (repository === fixtureRepositories.unreachable) {
      throw new Error("The network is unreachable");
    }

    if (repository === fixtureRepositories.missing) {
      return new Response("Not found", { status: 404 });
    }

    if (repository === fixtureRepositories.slow) {
      await new Promise((resolve) => setTimeout(resolve, slowRepositoryDelayMillis));
    } else if (repository !== fixtureRepositories.readable) {
      return echo(request);
    }

    if (url.pathname.endsWith("/info/refs")) {
      const advertisedRefs = runUploadPack(bareRepositoryPath(), undefined, "--advertise-refs");

      return new Response(
        Buffer.concat([
          Buffer.from(pktLine("# service=git-upload-pack\n")),
          Buffer.from("0000"),
          advertisedRefs,
        ]),
        { headers: { "content-type": advertisementContentType } },
      );
    }

    if (url.pathname.endsWith("/git-upload-pack")) {
      return new Response(
        runUploadPack(bareRepositoryPath(), new Uint8Array(await request.arrayBuffer())),
        {
          headers: { "content-type": uploadResultContentType },
        },
      );
    }

    return echo(request);
  };
};
