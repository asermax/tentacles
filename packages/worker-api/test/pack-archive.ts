import { packTar } from "modern-tar";

/** A regular file to pack; `mode` holds its permission bits. */
export interface PackedFile {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly mode: number;
}

const gzip = async (bytes: Uint8Array<ArrayBuffer>) =>
  new Uint8Array(
    await new Response(
      new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer(),
  );

/** A tar.gz of the files, for tests that need an archive the Worker reads. */
export const packArchive = async (files: ReadonlyArray<PackedFile>) =>
  gzip(
    await packTar(
      files.map((file) => ({
        header: { name: file.path, size: file.bytes.byteLength, mode: file.mode },
        body: file.bytes,
      })),
    ),
  );
