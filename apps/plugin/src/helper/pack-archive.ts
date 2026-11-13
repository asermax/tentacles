import type { ArchiveEntry } from "@tentacles/worker-api/archives";
import * as Effect from "effect/Effect";
import { packTar } from "modern-tar";

const gzip = async (bytes: Uint8Array<ArrayBuffer>) =>
  new Uint8Array(
    await new Response(
      new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer(),
  );

/** Packs entries into a tar.gz, the form worker-api's `readArchive` reads; only the helper packs. */
export const packArchive = (entries: ReadonlyArray<ArchiveEntry>) =>
  Effect.promise(async () =>
    gzip(
      await packTar(
        entries.map((entry) => ({
          header: { name: entry.path, size: entry.bytes.byteLength, mode: entry.mode },
          body: entry.bytes,
        })),
      ),
    ),
  );
