import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The repositories the fixture answers for, by their path under github.com. */
export const fixtureRepositories = {
  readable: "acme/app",
  missing: "acme/missing",
  unreachable: "acme/unreachable",
} as const;

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.name=seed", "-c", "user.email=seed@tentacles.test", ...args], {
    cwd,
    stdio: "ignore",
  });

// A bare repository with two commits on main, so a depth-1 clone leaves its history shallow.
const seedRepository = () => {
  const root = mkdtempSync(join(tmpdir(), "tentacles-github-"));
  const bare = join(root, "app.git");
  const seed = join(root, "seed");

  mkdirSync(seed);
  git(root, "init", "--bare", "-b", "main", bare);
  git(seed, "init", "-b", "main");
  execFileSync("sh", ["-c", "echo '# app' > README.md && mkdir src && echo 'one' > src/index.ts"], {
    cwd: seed,
  });
  git(seed, "add", ".");
  git(seed, "commit", "-m", "first");
  execFileSync("sh", ["-c", "echo 'two' > src/index.ts"], { cwd: seed });
  git(seed, "commit", "-am", "second");
  git(seed, "push", bare, "main");

  return bare;
};

const pktLine = (text: string) => `${(text.length + 4).toString(16).padStart(4, "0")}${text}`;

const advertisement = "application/x-git-upload-pack-advertisement";

const result = "application/x-git-upload-pack-result";

const upload = (bare: string, input: Uint8Array | undefined, ...args: string[]) =>
  spawnSync("git", ["upload-pack", "--stateless-rpc", ...args, bare], {
    input,
    maxBuffer: 64 * 1024 * 1024,
  }).stdout;

/**
 * What the Workspace Worker's outbound requests reach in the tests: GitHub's smart HTTP protocol
 * for the fixture repositories, served by git's own upload-pack, and every other request answered
 * with what it carried. `unreachable` makes the request throw, as a network that is down does.
 */
export const githubFixture = () => {
  const bare = seedRepository();

  return async (request: Request) => {
    const url = new URL(request.url);

    if (url.hostname === "github.com") {
      const [owner, name] = url.pathname.split("/").slice(1);
      const repository = `${owner}/${name?.replace(/\.git$/, "")}`;

      if (repository === fixtureRepositories.unreachable) {
        throw new Error("The network is unreachable");
      }

      if (repository === fixtureRepositories.missing) {
        return new Response("Not found", { status: 404 });
      }

      if (repository === fixtureRepositories.readable) {
        if (url.pathname.endsWith("/info/refs")) {
          const refs = upload(bare, undefined, "--advertise-refs");

          return new Response(
            Buffer.concat([
              Buffer.from(pktLine("# service=git-upload-pack\n")),
              Buffer.from("0000"),
              refs,
            ]),
            { headers: { "content-type": advertisement } },
          );
        }

        if (url.pathname.endsWith("/git-upload-pack")) {
          return new Response(upload(bare, new Uint8Array(await request.arrayBuffer())), {
            headers: { "content-type": result },
          });
        }
      }
    }

    return Response.json({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers),
    });
  };
};
