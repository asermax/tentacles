import { packTar } from "modern-tar";

interface ArchiveFile {
  readonly path: string;
  readonly content: string | Uint8Array;
}

const packArchive = async (files: ReadonlyArray<ArchiveFile>) => {
  const tar = await packTar(
    files.map((file) => ({
      header: { name: file.path, size: Buffer.byteLength(file.content) },
      body: file.content,
    })),
  );

  const gzipped = new Blob([tar]).stream().pipeThrough(new CompressionStream("gzip"));

  return new Uint8Array(await new Response(gzipped).arrayBuffer());
};

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
