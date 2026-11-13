import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";

import type { ArchiveEntry } from "@tentacles/worker-api/archives";
import {
  checkAgents,
  checkSkills,
  Problem,
  type AgentSource,
  type SkillSource,
} from "@tentacles/worker-api/definitions";
import { maxArchiveBytes } from "@tentacles/worker-api/sessions";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";
import type * as Types from "effect/Types";

import { packArchive } from "./pack-archive.ts";

/** Both archives packed, each present only when its group had paths. */
export const Packed = Schema.TaggedStruct("Packed", {
  skills: Schema.optionalKey(Schema.Uint8Array),
  agents: Schema.optionalKey(Schema.Uint8Array),
});

export type Packed = typeof Packed.Type;

/** Every problem of every path, per group; nothing is sent. */
export const Rejected = Schema.TaggedStruct("Rejected", {
  skills: Schema.Array(Problem),
  agents: Schema.Array(Problem),
});

export type Rejected = typeof Rejected.Type;

type Archives = Types.Mutable<Omit<Packed, "_tag">>;

export interface DefinitionPaths {
  readonly skills: ReadonlyArray<string>;
  readonly agents: ReadonlyArray<string>;
}

const skillFile = "SKILL.md";

const decoder = new TextDecoder();

const problemOf = (path: string, message: string): Problem => ({ path, message });

const isNotFound = (cause: unknown) =>
  Predicate.hasProperty(cause, "code") && cause.code === "ENOENT";

const inspect = (path: string, kind: "folder" | "file") =>
  Effect.tryPromise({
    try: () => stat(path),
    catch: (cause) =>
      problemOf(path, isNotFound(cause) ? "does not exist" : `cannot be read: ${String(cause)}`),
  }).pipe(
    Effect.filterOrFail(
      (info) => (kind === "folder" ? info.isDirectory() : info.isFile()),
      () => problemOf(path, `is not a ${kind}`),
    ),
  );

const permissionBits = 0o777;

const readFolder = (path: string, folder: string) =>
  Effect.tryPromise({
    try: async () => {
      const dirents = await readdir(path, { recursive: true, withFileTypes: true });

      const entries = await Promise.all(
        dirents.map(async (dirent): Promise<ArchiveEntry | undefined> => {
          const file = join(dirent.parentPath, dirent.name);

          const info = await stat(file);

          if (!info.isFile()) {
            return undefined;
          }

          return {
            path: `${folder}/${relative(path, file).split(sep).join("/")}`,
            bytes: await readFile(file),
            mode: info.mode & permissionBits,
          };
        }),
      );

      return entries
        .filter((entry) => entry != null)
        .toSorted((left, right) => left.path.localeCompare(right.path));
    },
    catch: (cause) => problemOf(path, `cannot be read: ${String(cause)}`),
  });

const readSkill = (path: string) =>
  Effect.gen(function* () {
    yield* inspect(path, "folder");

    const folder = basename(resolve(path));
    const entries = yield* readFolder(path, folder);
    const skill = entries.find((entry) => entry.path === `${folder}/${skillFile}`);

    if (skill == null) {
      return yield* Effect.fail(problemOf(path, `has no ${skillFile}`));
    }

    return {
      source: { folder, path, text: decoder.decode(skill.bytes) } satisfies SkillSource,
      entries,
    };
  });

const readAgent = (path: string) =>
  Effect.gen(function* () {
    const info = yield* inspect(path, "file");

    const bytes = yield* Effect.tryPromise({
      try: () => readFile(path),
      catch: (cause) => problemOf(path, `cannot be read: ${String(cause)}`),
    });

    return {
      source: { path, text: decoder.decode(bytes) } satisfies AgentSource,
      entries: [{ path: basename(path), bytes, mode: info.mode & permissionBits }],
    };
  });

// Agents are packed by file name, so two files with one name from different
// folders would land at the same path in the archive.
const sharedFileNames = (paths: ReadonlyArray<string>) => {
  const firstOf = new Map<string, string>();

  return paths.flatMap((path) => {
    const file = basename(path);
    const first = firstOf.get(file);

    if (first == null) {
      firstOf.set(file, path);

      return [];
    }

    return [problemOf(path, `file name '${file}' is already used by ${first}`)];
  });
};

const megabytes = (bytes: number) => `${(bytes / 1024 ** 2).toFixed(1)} MB`;

// A group with problems is not packed: its size would count definitions the
// agent has to fix anyway.
const packGroup = (
  kind: "skills" | "agents",
  problems: ReadonlyArray<Problem>,
  entries: ReadonlyArray<ArchiveEntry>,
) =>
  Effect.gen(function* () {
    if (problems.length > 0 || entries.length === 0) {
      return { problems, archive: undefined };
    }

    const archive = yield* packArchive(entries);

    if (archive.byteLength > maxArchiveBytes) {
      return {
        problems: [
          problemOf(
            `the ${kind} archive`,
            `is ${megabytes(archive.byteLength)}, over the ${maxArchiveBytes / 1024 ** 2} MB limit`,
          ),
        ],
        archive: undefined,
      };
    }

    return { problems, archive };
  });

/** Reads every path the agent passed, runs worker-api's checks on each group and packs the archives; reports every problem, never stops at the first. */
export const readDefinitions = ({ skills: skillPaths, agents: agentPaths }: DefinitionPaths) =>
  Effect.gen(function* () {
    const [skillReads, skillUnreadable] = yield* Effect.partition(skillPaths, readSkill, {
      concurrency: "unbounded",
    });

    const [agentReads, agentUnreadable] = yield* Effect.partition(agentPaths, readAgent, {
      concurrency: "unbounded",
    });

    const skills = yield* packGroup(
      "skills",
      [...skillUnreadable, ...checkSkills(skillReads.map((read) => read.source)).problems],
      skillReads.flatMap((read) => read.entries),
    );

    const agents = yield* packGroup(
      "agents",
      [
        ...agentUnreadable,
        ...sharedFileNames(agentReads.map((read) => read.source.path)),
        ...checkAgents(agentReads.map((read) => read.source)).problems,
      ],
      agentReads.flatMap((read) => read.entries),
    );

    if (skills.problems.length > 0 || agents.problems.length > 0) {
      return Rejected.make({ skills: skills.problems, agents: agents.problems });
    }

    const archives: Archives = {};

    if (skills.archive != null) {
      archives.skills = skills.archive;
    }

    if (agents.archive != null) {
      archives.agents = agents.archive;
    }

    return Packed.make(archives);
  });

const section = (heading: string, problems: ReadonlyArray<Problem>) =>
  `${heading}:\n${problems.map((problem) => `- ${problem.path}: ${problem.message}`).join("\n")}`;

/** The tool's error text: every problem with its path, the skills' under one heading and the agents' under another. */
export const rejectionText = (rejected: Rejected) =>
  [
    "No session was created: some skills or agents have problems.",
    ...(rejected.skills.length > 0 ? [section("Skills", rejected.skills)] : []),
    ...(rejected.agents.length > 0 ? [section("Agents", rejected.agents)] : []),
  ].join("\n\n");
