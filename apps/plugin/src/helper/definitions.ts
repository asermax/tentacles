import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";

import {
  type ArchiveEntry,
  packArchive,
  permissionBits,
  skillFile,
} from "@tentacles/worker-api/archives";
import {
  checkAgents,
  checkSkills,
  Problem,
  type AgentSource,
  type SkillSource,
} from "@tentacles/worker-api/definitions";
import { repairFrontmatter } from "@tentacles/worker-api/frontmatter";
import { type CreateSession, maxArchiveBytes } from "@tentacles/worker-api/sessions";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import type * as Types from "effect/Types";

import type { SpawnRequest } from "../core/spawn-request";

/** Every problem of every path, per group; nothing is sent. */
export const Rejected = Schema.TaggedStruct("Rejected", {
  skills: Schema.Array(Problem),
  agents: Schema.Array(Problem),
  context: Schema.Array(Problem),
});

export type Rejected = typeof Rejected.Type;

export type DefinitionPaths = Required<Pick<SpawnRequest, "skills" | "agents" | "context">>;

const decoder = new TextDecoder();

const encoder = new TextEncoder();

/** A definition file as the helper sends it: its text with the frontmatter repaired when strict YAML rejects it, and the entry carrying that text. */
const definitionFile = (path: string, bytes: Uint8Array, mode: number) => {
  const original = decoder.decode(bytes);
  const text = repairFrontmatter(original);

  return {
    text,
    entry: {
      path,
      bytes: text === original ? bytes : encoder.encode(text),
      mode,
    } satisfies ArchiveEntry,
  };
};

const megabytes = (bytes: number) => `${(bytes / 1024 ** 2).toFixed(1)} MB`;

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

    const { text, entry } = definitionFile(skill.path, skill.bytes, skill.mode);

    return {
      source: { folder, path, text } satisfies SkillSource,
      entries: entries.map((existing) => (existing === skill ? entry : existing)),
    };
  });

/** A context path: a file becomes one entry at its name, a folder its regular files under its name. */
const readContext = (path: string) =>
  Effect.gen(function* () {
    const info = yield* Effect.tryPromise({
      try: () => stat(path),
      catch: (cause) =>
        problemOf(path, isNotFound(cause) ? "does not exist" : `cannot be read: ${String(cause)}`),
    });

    const name = basename(resolve(path));

    if (info.isDirectory()) {
      return yield* readFolder(path, name);
    }

    if (!info.isFile()) {
      return yield* Effect.fail(problemOf(path, "is not a file or a folder"));
    }

    const bytes = yield* Effect.tryPromise({
      try: () => readFile(path),
      catch: (cause) => problemOf(path, `cannot be read: ${String(cause)}`),
    });

    return [{ path: name, bytes, mode: info.mode & permissionBits }] satisfies ArchiveEntry[];
  });

/** A problem on every context path whose name an earlier path already has. */
const duplicateNames = (paths: ReadonlyArray<string>) => {
  const firstByName = new Map<string, string>();

  return paths.flatMap((path) => {
    const name = basename(resolve(path));
    const first = firstByName.get(name);

    if (first == null) {
      firstByName.set(name, path);

      return [];
    }

    return [problemOf(path, `has the same name as ${first}`)];
  });
};

const readAgent = (path: string) =>
  Effect.gen(function* () {
    const info = yield* inspect(path, "file");

    const bytes = yield* Effect.tryPromise({
      try: () => readFile(path),
      catch: (cause) => problemOf(path, `cannot be read: ${String(cause)}`),
    });

    const { text, entry } = definitionFile(basename(path), bytes, info.mode & permissionBits);

    return {
      source: { path, text } satisfies AgentSource,
      entries: [entry],
    };
  });

// A group with problems is not packed: its size would count definitions the
// agent has to fix anyway. A group with nothing to pack succeeds with no archive.
const packGroup = (
  kind: "skills" | "agents" | "context",
  problems: ReadonlyArray<Problem>,
  entries: ReadonlyArray<ArchiveEntry>,
) =>
  Effect.gen(function* () {
    if (problems.length > 0) {
      return yield* Effect.fail(problems);
    }

    if (entries.length === 0) {
      return undefined;
    }

    const archive = yield* packArchive(entries);

    if (archive.byteLength > maxArchiveBytes) {
      return yield* Effect.fail([
        problemOf(
          `the ${kind} archive`,
          `is ${megabytes(archive.byteLength)}, over the ${megabytes(maxArchiveBytes)} limit`,
        ),
      ]);
    }

    return archive;
  }).pipe(Effect.result);

/** Reads every path the agent passed, runs worker-api's checks on each group and packs the archives, each present only when its group had paths; fails with every problem of every path, never at the first. */
export const readDefinitions = ({
  skills: skillPaths,
  agents: agentPaths,
  context: contextPaths,
}: DefinitionPaths) =>
  Effect.gen(function* () {
    const [
      [skillReads, skillUnreadable],
      [agentReads, agentUnreadable],
      [contextReads, contextUnreadable],
    ] = yield* Effect.all(
      [
        Effect.partition(skillPaths, readSkill, { concurrency: "unbounded" }),
        Effect.partition(agentPaths, readAgent, { concurrency: "unbounded" }),
        Effect.partition(contextPaths, readContext, { concurrency: "unbounded" }),
      ],
      { concurrency: 3 },
    );

    const [skills, agents, context] = yield* Effect.all(
      [
        packGroup(
          "skills",
          [...skillUnreadable, ...checkSkills(skillReads.map((read) => read.source)).problems],
          skillReads.flatMap((read) => read.entries),
        ),
        packGroup(
          "agents",
          [...agentUnreadable, ...checkAgents(agentReads.map((read) => read.source)).problems],
          agentReads.flatMap((read) => read.entries),
        ),
        packGroup(
          "context",
          [...contextUnreadable, ...duplicateNames(contextPaths)],
          contextReads.flat(),
        ),
      ],
      { concurrency: 3 },
    );

    if (Result.isFailure(skills) || Result.isFailure(agents) || Result.isFailure(context)) {
      return yield* Effect.fail(
        Rejected.make({
          skills: Result.isFailure(skills) ? skills.failure : [],
          agents: Result.isFailure(agents) ? agents.failure : [],
          context: Result.isFailure(context) ? context.failure : [],
        }),
      );
    }

    const archives: Types.Mutable<Pick<CreateSession, "skills" | "agents" | "context">> = {};

    if (skills.success != null) {
      archives.skills = skills.success;
    }

    if (agents.success != null) {
      archives.agents = agents.success;
    }

    if (context.success != null) {
      archives.context = context.success;
    }

    return archives;
  });

const section = (heading: string, problems: ReadonlyArray<Problem>) =>
  `${heading}:\n${problems.map((problem) => `- ${problem.path}: ${problem.message}`).join("\n")}`;

/** The tool's error text: every problem with its path, the skills' under one heading and the agents' under another. */
export const rejectionText = (rejected: Rejected) =>
  [
    "No session was created: some skills, agents or context have problems.",
    ...(rejected.skills.length > 0 ? [section("Skills", rejected.skills)] : []),
    ...(rejected.agents.length > 0 ? [section("Agents", rejected.agents)] : []),
    ...(rejected.context.length > 0 ? [section("Context", rejected.context)] : []),
  ].join("\n\n");
