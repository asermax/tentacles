import type { ArchiveEntry } from "@tentacles/worker-api/archives";
import { packArchive as packEntries } from "@tentacles/worker-api/test/pack-archive";
import * as Predicate from "effect/Predicate";

interface ArchiveFile {
  readonly path: string;
  readonly content: string | Uint8Array;
  readonly mode?: number;
}

const encoder = new TextEncoder();

const entriesOf = (files: ReadonlyArray<ArchiveFile>): ArchiveEntry[] =>
  files.map((file) => ({
    path: file.path,
    bytes: Predicate.isString(file.content) ? encoder.encode(file.content) : file.content,
    mode: file.mode ?? 0o644,
  }));

const packArchive = (files: ReadonlyArray<ArchiveFile>) => packEntries(entriesOf(files));

// getRandomValues takes at most 64 KiB at a time.
const incompressible = (size: number) => {
  const bytes = new Uint8Array(size);

  for (let offset = 0; offset < size; offset += 65_536) {
    crypto.getRandomValues(bytes.subarray(offset, offset + 65_536));
  }

  return bytes;
};

const definition = (name: string, body: string) =>
  `---\nname: ${name}\ndescription: The ${name} skill\n---\n\n${body}`;

const skillFiles = (name: string, fillerBytes: number): ArchiveFile[] => [
  { path: `${name}/SKILL.md`, content: definition(name, `Follow ${name}.`) },
  ...(fillerBytes === 0
    ? []
    : [{ path: `${name}/filler.bin`, content: incompressible(fillerBytes) }]),
];

const contextFiles = (name: string, fillerBytes: number): ArchiveFile[] => [
  { path: name, content: fillerBytes === 0 ? "context\n" : incompressible(fillerBytes) },
];

/** A skills archive holding the skill `name`, plus a file of incompressible bytes beside it. */
export const skillsArchive = (name: string, fillerBytes = 0) =>
  packArchive(skillFiles(name, fillerBytes));

export const agentsArchive = (name: string) =>
  packArchive([{ path: `${name}.md`, content: definition(name, `You are ${name}.`) }]);

/** A context archive holding the file `name`, plus a file of incompressible bytes when `fillerBytes` is set. */
export const contextArchive = (name: string, fillerBytes = 0) =>
  packArchive(contextFiles(name, fillerBytes));

/** The files a workspace is set up from for the skill `name`, as the skills archive holds them. */
export const skillEntries = (name: string) => entriesOf(skillFiles(name, 0));

/** The files a workspace is set up from for the context file `name`. */
export const contextEntries = (name: string) => entriesOf(contextFiles(name, 0));

/** The context files `name` and an executable script, run.sh. */
export const contextEntriesWithScript = (name: string) =>
  entriesOf([
    { path: name, content: "context\n" },
    { path: "run.sh", content: "#!/bin/sh\n", mode: 0o755 },
  ]);

/** Context files whose second path lies inside the first, a file, so writing them fails. */
export const conflictingContextEntries = (name: string) =>
  entriesOf([
    { path: name, content: "context\n" },
    { path: `${name}/inner.md`, content: "inner\n" },
  ]);
