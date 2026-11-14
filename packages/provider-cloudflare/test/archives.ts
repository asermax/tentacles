import { packArchive as packEntries } from "@tentacles/worker-api/test/pack-archive";
import * as Predicate from "effect/Predicate";

interface ArchiveFile {
  readonly path: string;
  readonly content: string | Uint8Array;
}

const encoder = new TextEncoder();

const packArchive = (files: ReadonlyArray<ArchiveFile>) =>
  packEntries(
    files.map((file) => ({
      path: file.path,
      bytes: Predicate.isString(file.content) ? encoder.encode(file.content) : file.content,
      mode: 0o644,
    })),
  );

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

/** A skills archive holding the skill `name`, plus a file of incompressible bytes beside it. */
export const skillsArchive = (name: string, fillerBytes = 0) =>
  packArchive([
    { path: `${name}/SKILL.md`, content: definition(name, `Follow ${name}.`) },
    ...(fillerBytes === 0
      ? []
      : [{ path: `${name}/filler.bin`, content: incompressible(fillerBytes) }]),
  ]);

export const agentsArchive = (name: string) =>
  packArchive([{ path: `${name}.md`, content: definition(name, `You are ${name}.`) }]);

/** A context archive holding the file `name`, plus a file of incompressible bytes when `fillerBytes` is set. */
export const contextArchive = (name: string, fillerBytes = 0) =>
  packArchive([
    { path: name, content: fillerBytes === 0 ? "context\n" : incompressible(fillerBytes) },
  ]);
