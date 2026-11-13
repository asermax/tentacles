import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { unpackTar } from "modern-tar";

import { checkAgents, checkSkills, type Problem } from "./definitions.ts";
import { InvalidArchive } from "./errors.ts";

export class ArchiveUnreadable extends Schema.TaggedError<ArchiveUnreadable>()(
  "ArchiveUnreadable",
  { message: Schema.String },
) {}

export interface ArchiveEntry {
  readonly path: string;
  readonly bytes: Uint8Array;
  /** The file's permission bits, as in `stat`'s mode & 0o777. */
  readonly mode: number;
}

const skillFile = "SKILL.md";

const defaultMode = 0o644;

const permissionBits = 0o777;

const gunzip = (bytes: Uint8Array) =>
  new ReadableStream<Uint8Array<ArrayBuffer>>({
    start: (controller) => {
      controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  }).pipeThrough(new DecompressionStream("gzip"));

/** The regular files of a tar.gz, with their paths normalized (no leading `./`). */
export const readArchive = (bytes: Uint8Array) =>
  Effect.tryPromise({
    try: () => unpackTar(gunzip(bytes), { strict: true }),
    catch: (cause) =>
      new ArchiveUnreadable({ message: `it is not a readable tar.gz: ${String(cause)}` }),
  }).pipe(
    Effect.map((entries) =>
      entries
        .filter((entry) => entry.header.type === "file" || entry.header.type == null)
        .map((entry): ArchiveEntry => ({
          path: entry.header.name.replace(/^(\.\/)+/, ""),
          bytes: entry.data ?? new Uint8Array(),
          mode: (entry.header.mode ?? defaultMode) & permissionBits,
        })),
    ),
  );

const decoder = new TextDecoder();

const invalid = (kind: string, problems: ReadonlyArray<Problem>) =>
  new InvalidArchive({
    message: `The ${kind} archive is invalid: ${problems
      .map((problem) => `${problem.path}: ${problem.message}`)
      .join("; ")}`,
  });

const unreadable = (kind: string) => (error: ArchiveUnreadable) =>
  new InvalidArchive({ message: `The ${kind} archive is invalid: ${error.message}` });

/** The skills of a skills archive: one folder per skill at its top level, each with a SKILL.md. */
export const readSkillsArchive = (bytes: Uint8Array) =>
  readArchive(bytes).pipe(
    Effect.mapError(unreadable("skills")),
    Effect.flatMap((entries) => {
      const folders = new Set<string>();
      const problems: Array<Problem> = [];
      const sources: Array<{ folder: string; path: string; text: string }> = [];

      for (const entry of entries) {
        const [folder = "", ...rest] = entry.path.split("/");

        if (rest.length === 0 || folder === "") {
          problems.push({ path: entry.path, message: "is not inside a skill folder" });

          continue;
        }

        folders.add(folder);

        if (rest.length === 1 && rest[0] === skillFile) {
          sources.push({ folder, path: entry.path, text: decoder.decode(entry.bytes) });
        }
      }

      for (const folder of folders) {
        if (!sources.some((source) => source.folder === folder)) {
          problems.push({ path: folder, message: `has no ${skillFile}` });
        }
      }

      const checked = checkSkills(sources);
      const all = [...problems, ...checked.problems];

      return all.length === 0
        ? Effect.succeed(checked.skills)
        : Effect.fail(invalid("skills", all));
    }),
  );

/** The agents of an agents archive: one definition file per agent at its top level. */
export const readAgentsArchive = (bytes: Uint8Array) =>
  readArchive(bytes).pipe(
    Effect.mapError(unreadable("agents")),
    Effect.flatMap((entries) => {
      const nested = entries
        .filter((entry) => entry.path.includes("/"))
        .map((entry): Problem => ({ path: entry.path, message: "is not at the top level" }));

      const checked = checkAgents(
        entries
          .filter((entry) => !entry.path.includes("/"))
          .map((entry) => ({ path: entry.path, text: decoder.decode(entry.bytes) })),
      );

      const all = [...nested, ...checked.problems];

      return all.length === 0
        ? Effect.succeed(checked.agents)
        : Effect.fail(invalid("agents", all));
    }),
  );
