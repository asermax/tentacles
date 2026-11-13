import { ArchiveStore } from "@tentacles/contracts/archive-store";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

// Skills keep the key they were stored under before the store covered every kind, so a live
// session still finds its archive.
const archiveKey = (kind: string) => `tentacles.${kind}-archive`;

export const archiveStoreLayer = (storage: DurableObjectStorage) =>
  Layer.succeed(
    ArchiveStore,
    ArchiveStore.of({
      save: (kind, archive) => Effect.sync(() => storage.kv.put(archiveKey(kind), archive)),
      read: (kind) =>
        Effect.sync(() => {
          const stored: unknown = storage.kv.get(archiveKey(kind));

          return stored instanceof Uint8Array ? stored : null;
        }),
    }),
  );
