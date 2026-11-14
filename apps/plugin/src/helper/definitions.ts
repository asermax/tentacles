import { readFile, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

import {
  archiveKindNames,
  archiveKinds,
  type ArchiveKind,
} from "@tentacles/worker-api/archive-kinds";
import { permissionBits, skillFile } from "@tentacles/worker-api/archives";
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
import * as Record from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import type * as Types from "effect/Types";
import { type ContentSource, type PackOptionsFS, packTar, type TarSource } from "modern-tar/fs";

import type { SpawnRequest } from "../core/spawn-request";

/** Every problem of every path, per kind; nothing is sent. */
export const Rejected = Schema.TaggedStruct("Rejected", {
  ...Record.map(archiveKinds, () => Schema.Array(Problem)),
});

export type Rejected = typeof Rejected.Type;

type DefinitionPaths = Required<Pick<SpawnRequest, ArchiveKind>>;

/** What a kind's check settles about its paths: what goes into the package, and the packer's filter when some files on disk are replaced by content sources. */
interface Checked {
  readonly sources: ReadonlyArray<TarSource>;
  readonly filter?: NonNullable<PackOptionsFS["filter"]>;
}

const decoder = new TextDecoder();

const encoder = new TextEncoder();

/** A definition file as the helper sends it: its text with the frontmatter repaired when strict YAML rejects it, and the package source carrying that text. */
const definitionFile = (target: string, bytes: Uint8Array, mode: number) => {
  const original = decoder.decode(bytes);
  const text = repairFrontmatter(original);

  return {
    text,
    source: {
      type: "content",
      target,
      content: text === original ? bytes : encoder.encode(text),
      mode,
    } satisfies ContentSource,
  };
};

const megabytes = (bytes: number) => `${(bytes / 1024 ** 2).toFixed(1)} MB`;

const problemOf = (path: string, message: string): Problem => ({ path, message });

const isNotFound = (cause: unknown) =>
  Predicate.hasProperty(cause, "code") && cause.code === "ENOENT";

const statPath = (path: string) =>
  Effect.tryPromise({
    try: () => stat(path),
    catch: (cause) =>
      problemOf(path, isNotFound(cause) ? "does not exist" : `cannot be read: ${String(cause)}`),
  });

const inspect = (path: string, kind: "folder" | "file") =>
  statPath(path).pipe(
    Effect.filterOrFail(
      (info) => (kind === "folder" ? info.isDirectory() : info.isFile()),
      () => problemOf(path, `is not a ${kind}`),
    ),
  );

const readText = (path: string, problemPath: string) =>
  Effect.tryPromise({
    try: () => readFile(path),
    catch: (cause) => problemOf(problemPath, `cannot be read: ${String(cause)}`),
  });

const readSkill = (path: string) =>
  Effect.gen(function* () {
    yield* inspect(path, "folder");

    const root = resolve(path);
    const folder = basename(root);
    const skillPath = join(root, skillFile);

    const missing = problemOf(path, `has no ${skillFile}`);

    const info = yield* Effect.tryPromise({
      try: () => stat(skillPath),
      catch: (cause) =>
        isNotFound(cause) ? missing : problemOf(path, `cannot be read: ${String(cause)}`),
    }).pipe(
      Effect.filterOrFail(
        (found) => found.isFile(),
        () => missing,
      ),
    );

    const { text, source } = definitionFile(
      `${folder}/${skillFile}`,
      yield* readText(skillPath, path),
      info.mode & permissionBits,
    );

    return {
      skill: { folder, path, text } satisfies SkillSource,
      sources: [{ type: "directory", source: root, target: folder }, source] satisfies TarSource[],
      replaced: skillPath,
    };
  });

const readAgent = (path: string) =>
  Effect.gen(function* () {
    const info = yield* inspect(path, "file");

    const { text, source } = definitionFile(
      basename(path),
      yield* readText(path, path),
      info.mode & permissionBits,
    );

    return { agent: { path, text } satisfies AgentSource, sources: [source] };
  });

/** A context path is checked by its stat alone: nothing in a folder is read here. */
const readContext = (path: string) =>
  Effect.gen(function* () {
    const info = yield* statPath(path);

    if (!info.isDirectory() && !info.isFile()) {
      return yield* Effect.fail(problemOf(path, "is not a file or a folder"));
    }

    const source = resolve(path);
    const target = basename(source);

    return info.isDirectory()
      ? ({ type: "directory", source, target } satisfies TarSource)
      : ({ type: "file", source, target } satisfies TarSource);
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

type Check = (paths: ReadonlyArray<string>) => Effect.Effect<Checked, ReadonlyArray<Problem>>;

/** Reads every path, adds the problems the kind finds across the readable ones, and builds the result only when there is none. */
const checkPaths = <Read>(
  paths: ReadonlyArray<string>,
  read: (path: string) => Effect.Effect<Read, Problem>,
  problemsOf: (reads: ReadonlyArray<Read>) => ReadonlyArray<Problem>,
  build: (reads: ReadonlyArray<Read>) => Checked,
) =>
  Effect.gen(function* () {
    const [reads, unreadable] = yield* Effect.partition(paths, read, { concurrency: "unbounded" });
    const problems = [...unreadable, ...problemsOf(reads)];

    return problems.length > 0 ? yield* Effect.fail(problems) : build(reads);
  });

const checkSkillPaths: Check = (paths) =>
  checkPaths(
    paths,
    readSkill,
    (reads) => checkSkills(reads.map((read) => read.skill)).problems,
    (reads) => {
      const replaced = new Set(reads.map((read) => read.replaced));

      return {
        sources: reads.flatMap((read) => read.sources),
        filter: (path) => !replaced.has(path),
      };
    },
  );

const checkAgentPaths: Check = (paths) =>
  checkPaths(
    paths,
    readAgent,
    (reads) => checkAgents(reads.map((read) => read.agent)).problems,
    (reads) => ({ sources: reads.flatMap((read) => read.sources) }),
  );

const checkContextPaths: Check = (paths) =>
  checkPaths(
    paths,
    readContext,
    () => duplicateNames(paths),
    (sources) => ({ sources }),
  );

const checks: Record<ArchiveKind, Check> = {
  skills: checkSkillPaths,
  agents: checkAgentPaths,
  context: checkContextPaths,
};

// modern-tar's packer reads the files while it packs; the package is checked once it exists.
// dereference follows symlinks and packs their targets, and baseDir "/" lets a target sit anywhere.
const pack = (kind: ArchiveKind, { sources, ...options }: Checked) =>
  Effect.tryPromise({
    try: async () => {
      const chunks: Array<Uint8Array> = [];

      await pipeline(
        packTar(sources, {
          dereference: true,
          baseDir: "/",
          ...options,
        }),
        createGzip(),
        async (packed) => {
          for await (const chunk of packed) {
            chunks.push(chunk);
          }
        },
      );

      return Buffer.concat(chunks);
    },
    catch: (cause) => [problemOf(`the ${kind} archive`, `cannot be packed: ${String(cause)}`)],
  }).pipe(
    Effect.filterOrFail(
      (archive) => archive.byteLength <= maxArchiveBytes,
      (archive) => [
        problemOf(
          `the ${kind} archive`,
          `is ${megabytes(archive.byteLength)}, over the ${megabytes(maxArchiveBytes)} limit`,
        ),
      ],
    ),
  );

// A kind with problems is not packed: its size would count definitions the agent has to fix
// anyway. A kind with no paths succeeds with no archive.
const archiveOf = (kind: ArchiveKind, paths: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (paths.length === 0) {
      return undefined;
    }

    return yield* checks[kind](paths).pipe(Effect.flatMap((checked) => pack(kind, checked)));
  }).pipe(Effect.result);

/** Checks every path the agent passed, kind by kind, and packs each kind that had paths into an archive; fails with every problem of every path, never at the first. */
export const readDefinitions = (paths: DefinitionPaths) =>
  Effect.gen(function* () {
    const results = yield* Effect.all(
      Record.map(paths, (kindPaths, kind) => archiveOf(kind, kindPaths)),
      { concurrency: "unbounded" },
    );

    if (Object.values(results).some(Result.isFailure)) {
      return yield* Effect.fail(
        Rejected.make(
          Record.map(results, (result) => (Result.isFailure(result) ? result.failure : [])),
        ),
      );
    }

    const archives: Types.Mutable<Pick<CreateSession, ArchiveKind>> = {};

    for (const kind of archiveKindNames) {
      const result = results[kind];

      if (Result.isSuccess(result) && result.success != null) {
        archives[kind] = result.success;
      }
    }

    return archives;
  });

const section = (heading: string, problems: ReadonlyArray<Problem>) =>
  `${heading}:\n${problems.map((problem) => `- ${problem.path}: ${problem.message}`).join("\n")}`;

/** The tool's error text: every problem with its path, one section per kind with problems, in the kinds table's order. */
export const rejectionText = (rejected: Rejected) =>
  [
    "No session was created: some skills, agents or context have problems.",
    ...archiveKindNames.flatMap((kind) =>
      rejected[kind].length > 0 ? [section(archiveKinds[kind].heading, rejected[kind])] : [],
    ),
  ].join("\n\n");
