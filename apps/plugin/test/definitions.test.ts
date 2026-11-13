import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { readArchive } from "@tentacles/worker-api/archives";
import { InvalidArchive } from "@tentacles/worker-api/errors";
import * as Effect from "effect/Effect";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { Failure, Success } from "../src/core/helper-output.ts";
import { runHelperCommand, variablesFor } from "./helper-run.ts";
import { startStubWorker, type StubWorker } from "./stub-worker.ts";
import { helperErrorMessage, sessionIdOf } from "./values.ts";

const sessionId = sessionIdOf(1);

const parent = { harness: "pi", sessionId: "parent-session" };

const root = mkdtempSync(join(tmpdir(), "tentacles-definitions-"));

const nameFormat =
  "1 to 64 lowercase letters, digits and hyphens, with no leading, trailing or doubled hyphen";

const intro = "No session was created: some skills or agents have problems.";

let dir = "";

let counter = 0;

let worker: StubWorker | undefined;

const stubWorker = () => {
  if (worker == null) {
    throw new Error("The stub Worker is not started");
  }

  return worker;
};

beforeEach(async () => {
  counter += 1;
  dir = join(root, String(counter));
  worker = await startStubWorker({ createdId: sessionId });
});

afterEach(async () => {
  await worker?.stop();
  worker = undefined;
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

const write = (relativePath: string, content: string | Uint8Array) => {
  const path = join(dir, relativePath);

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);

  return path;
};

const definition = (fields: Record<string, string>, body = "Do the work.") =>
  `---\n${Object.entries(fields)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join("\n")}\n---\n${body}\n`;

/** A skill folder named `folder` whose SKILL.md says `fields`, with the extra files beside it. */
const skillFolder = (
  folder: string,
  fields: Record<string, string> = { name: folder, description: `The ${folder} skill.` },
  extra: Record<string, string | Uint8Array> = {},
  parentFolder = "skills",
) => {
  const path = join(dir, parentFolder, folder);

  write(join(parentFolder, folder, "SKILL.md"), definition(fields));

  for (const [file, content] of Object.entries(extra)) {
    write(join(parentFolder, folder, file), content);
  }

  return path;
};

const agentFile = (file: string, fields: Record<string, string>, body?: string) =>
  write(join("agents", file), definition(fields, body));

const spawn = (paths: { skills?: ReadonlyArray<string>; agents?: ReadonlyArray<string> }) =>
  runHelperCommand(
    "spawn",
    { name: "migrate", prompt: "go", parent, ...paths },
    variablesFor(stubWorker().url),
  );

const unpacked = async (archive: Uint8Array | undefined) =>
  Object.fromEntries(
    (await Effect.runPromise(readArchive(archive ?? new Uint8Array()))).map((entry) => [
      entry.path,
      new TextDecoder().decode(entry.bytes),
    ]),
  );

const modesOf = async (archive: Uint8Array | undefined) =>
  Object.fromEntries(
    (await Effect.runPromise(readArchive(archive ?? new Uint8Array()))).map((entry) => [
      entry.path,
      entry.mode,
    ]),
  );

const rejection = (...sections: ReadonlyArray<readonly [string, ReadonlyArray<string>]>) =>
  [intro, ...sections.map(([heading, problems]) => `${heading}:\n${problems.join("\n")}`)].join(
    "\n\n",
  );

describe("spawn with skill and agent definitions", () => {
  it("packs skill folders and agent files into the archives it sends with create", async () => {
    const implement = skillFolder("implement", undefined, {
      "scripts/run.sh": "echo run",
      "notes.md": "Notes.",
    });

    const review = skillFolder("review");
    const planner = agentFile("planner.md", { name: "planner", description: "Plans the work." });

    const reviewer = agentFile(
      "reviewer.md",
      { name: "reviewer", description: "Reviews the work." },
      "Review it.",
    );

    const result = await spawn({ skills: [implement, review], agents: [planner, reviewer] });
    const [created] = stubWorker().creates;

    expect(result).toEqual(Success.make({ result: { sessionId } }));
    expect(await unpacked(created?.skills)).toEqual({
      "implement/SKILL.md": definition({ name: "implement", description: "The implement skill." }),
      "implement/scripts/run.sh": "echo run",
      "implement/notes.md": "Notes.",
      "review/SKILL.md": definition({ name: "review", description: "The review skill." }),
    });
    expect(await unpacked(created?.agents)).toEqual({
      "planner.md": definition({ name: "planner", description: "Plans the work." }),
      "reviewer.md": definition(
        { name: "reviewer", description: "Reviews the work." },
        "Review it.",
      ),
    });
  });

  it("keeps the permission bits of each file in the archives it sends with create", async () => {
    const implement = skillFolder("implement", undefined, {
      "scripts/run.sh": "echo run",
      "notes.md": "Notes.",
    });

    const planner = agentFile("planner.md", { name: "planner", description: "Plans the work." });

    chmodSync(join(implement, "scripts/run.sh"), 0o755);
    chmodSync(join(implement, "notes.md"), 0o644);
    chmodSync(planner, 0o600);

    await spawn({ skills: [implement], agents: [planner] });

    const [created] = stubWorker().creates;

    expect(await modesOf(created?.skills)).toEqual({
      "implement/SKILL.md": 0o644,
      "implement/scripts/run.sh": 0o755,
      "implement/notes.md": 0o644,
    });
    expect(await modesOf(created?.agents)).toEqual({ "planner.md": 0o600 });
  });

  it("sends the skills archive and no agents archive when it gets skill paths only", async () => {
    const result = await spawn({ skills: [skillFolder("implement")] });
    const [created] = stubWorker().creates;

    expect(result).toEqual(Success.make({ result: { sessionId } }));
    expect(Object.keys(await unpacked(created?.skills))).toEqual(["implement/SKILL.md"]);
    expect(created).not.toHaveProperty("agents");
  });

  it("reports a skill path that does not exist and sends nothing", async () => {
    const missing = join(dir, "nowhere");

    const result = await spawn({ skills: [missing] });

    expect(helperErrorMessage(result)).toBe(
      rejection(["Skills", [`- ${missing}: does not exist`]]),
    );
    expect(stubWorker().requests).toEqual([]);
  });

  it("reports a skill folder without a SKILL.md", async () => {
    const empty = join(dir, "empty");

    write("empty/notes.md", "Notes.");

    const result = await spawn({ skills: [empty] });

    expect(helperErrorMessage(result)).toBe(rejection(["Skills", [`- ${empty}: has no SKILL.md`]]));
    expect(stubWorker().requests).toEqual([]);
  });

  it("reports a skill path that is not a folder", async () => {
    const file = write("skills/implement", "not a folder");

    const result = await spawn({ skills: [file] });

    expect(helperErrorMessage(result)).toBe(rejection(["Skills", [`- ${file}: is not a folder`]]));
  });

  it("reports a skill named Impl--x with the name format", async () => {
    const folder = skillFolder("Impl--x");

    const result = await spawn({ skills: [folder] });

    expect(helperErrorMessage(result)).toContain(`- ${folder}: `);
    expect(helperErrorMessage(result)).toContain(nameFormat);
    expect(stubWorker().requests).toEqual([]);
  });

  it("reports a skill whose frontmatter name differs from its folder, naming both", async () => {
    const folder = skillFolder("implement", { name: "impl", description: "Implements." });

    const result = await spawn({ skills: [folder] });

    expect(helperErrorMessage(result)).toBe(
      rejection(["Skills", [`- ${folder}: name 'impl' does not match the folder 'implement'`]]),
    );
  });

  it("reports a skill without a description and one with an empty description, one problem per path", async () => {
    const without = skillFolder("without", { name: "without" });
    const empty = skillFolder("empty", { name: "empty", description: "" });

    const message = helperErrorMessage(await spawn({ skills: [without, empty] }));

    expect(message).toContain(`- ${without}: description is missing`);
    expect(message).toContain(`- ${empty}: description is missing`);
    expect(message?.match(/^- /gm)).toHaveLength(2);
  });

  it("reports a skill whose description has 1025 characters with the 1 to 1024 limit", async () => {
    const folder = skillFolder("long", { name: "long", description: "x".repeat(1025) });

    const message = helperErrorMessage(await spawn({ skills: [folder] }));

    expect(message).toContain(`- ${folder}: `);
    expect(message).toContain("1 to 1024");
  });

  it("reports two folders whose skills share a name, naming both paths", async () => {
    const first = skillFolder("impl", undefined, {}, "one");
    const second = skillFolder("impl", undefined, {}, "two");

    const message = helperErrorMessage(await spawn({ skills: [first, second] }));

    expect(message).toBe(
      rejection(["Skills", [`- ${second}: name 'impl' is already used by ${first}`]]),
    );
  });

  it("reports skills that come to more than the archive limit together, though none is over it alone", async () => {
    const skills = ["alpha", "beta", "gamma"].map((name) =>
      skillFolder(name, undefined, { "data.bin": randomBytes(2 * 1024 * 1024) }),
    );

    const message = helperErrorMessage(await spawn({ skills }));

    expect(message).toMatch(
      new RegExp(
        `^${intro}\\n\\nSkills:\\n- the skills archive: is \\d+\\.\\d MB, over the 5 MB limit$`,
      ),
    );
    expect(stubWorker().requests).toEqual([]);
  });

  it("reports an agent whose body is empty under the agents heading", async () => {
    const agent = agentFile("empty.md", { name: "empty", description: "Has no body." }, "  ");

    const message = helperErrorMessage(await spawn({ agents: [agent] }));

    expect(message).toContain("Agents:");
    expect(message).toContain(`- ${agent}: body is empty`);
    expect(message).not.toContain("Skills:");
  });

  it("reports agents named Code Reviewer and -planner with the name format", async () => {
    const spaced = agentFile("spaced.md", { name: "Code Reviewer", description: "Reviews." });
    const hyphen = agentFile("hyphen.md", { name: "-planner", description: "Plans." });

    const message = helperErrorMessage(await spawn({ agents: [spaced, hyphen] }));

    expect(message).toContain(`- ${spaced}: `);
    expect(message).toContain(`- ${hyphen}: `);
    expect(message?.split(nameFormat)).toHaveLength(3);
  });

  it("reports an agent without a description and one with an empty description under the agents heading", async () => {
    const without = agentFile("without.md", { name: "without" });
    const empty = agentFile("empty.md", { name: "empty", description: "" });

    const message = helperErrorMessage(await spawn({ agents: [without, empty] }));

    expect(message).toContain("Agents:");
    expect(message).not.toContain("Skills:");
    expect(message).toContain(`- ${without}: description is missing`);
    expect(message).toContain(`- ${empty}: description is missing`);
    expect(message?.match(/^- /gm)).toHaveLength(2);
  });

  it("reports an agent whose description has 1025 characters with the 1 to 1024 limit", async () => {
    const agent = agentFile("long.md", { name: "long", description: "x".repeat(1025) });

    const message = helperErrorMessage(await spawn({ agents: [agent] }));

    expect(message).toContain(`- ${agent}: `);
    expect(message).toContain("1 to 1024");
  });

  it("reports agent files that come to more than the archive limit together under the agents heading", async () => {
    const agents = ["alpha", "beta", "gamma"].map((name) =>
      write(
        join("agents", `${name}.md`),
        Buffer.concat([
          Buffer.from(definition({ name, description: `The ${name} agent.` }, "")),
          randomBytes(2 * 1024 * 1024),
        ]),
      ),
    );

    const message = helperErrorMessage(await spawn({ agents }));

    expect(message).toMatch(
      new RegExp(
        `^${intro}\\n\\nAgents:\\n- the agents archive: is \\d+\\.\\d MB, over the 5 MB limit$`,
      ),
    );
    expect(stubWorker().requests).toEqual([]);
  });

  it("reports a missing skill path and a missing agent path under both headings and sends nothing", async () => {
    const skill = join(dir, "no-skill");
    const agent = join(dir, "no-agent.md");

    const result = await spawn({ skills: [skill], agents: [agent] });

    expect(helperErrorMessage(result)).toBe(
      rejection(
        ["Skills", [`- ${skill}: does not exist`]],
        ["Agents", [`- ${agent}: does not exist`]],
      ),
    );
    expect(stubWorker().requests).toEqual([]);
  });

  it("reports two agent files whose agents share a name, naming both paths", async () => {
    const first = agentFile("first.md", { name: "reviewer", description: "Reviews." });
    const second = agentFile("second.md", { name: "reviewer", description: "Reviews again." });

    const message = helperErrorMessage(await spawn({ agents: [first, second] }));

    expect(message).toBe(
      rejection(["Agents", [`- ${second}: name 'reviewer' is already used by ${first}`]]),
    );
  });

  it("reports agent files from different folders with the same file name, naming both paths", async () => {
    const first = write(
      join("one", "reviewer.md"),
      definition({ name: "reviewer", description: "Reviews." }),
    );

    const second = write(
      join("two", "reviewer.md"),
      definition({ name: "inspector", description: "Inspects." }),
    );

    const message = helperErrorMessage(await spawn({ agents: [first, second] }));

    expect(message).toBe(
      rejection(["Agents", [`- ${second}: file name 'reviewer.md' is already used by ${first}`]]),
    );
    expect(stubWorker().requests).toEqual([]);
  });

  it("answers Failure with the InvalidArchive the Worker returns", async () => {
    await stubWorker().stop();

    const error = new InvalidArchive({
      message: "The skills archive is invalid: it is not a tar.gz",
    });

    worker = await startStubWorker({ createFailure: error });

    const result = await spawn({
      skills: [skillFolder("implement")],
      agents: [agentFile("planner.md", { name: "planner", description: "Plans." })],
    });

    expect(result).toEqual(Failure.make({ error }));
  });
});
