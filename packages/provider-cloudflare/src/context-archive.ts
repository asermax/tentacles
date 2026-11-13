import { ContextArchive } from "@tentacles/contracts/context-archive";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const contextArchiveKey = "tentacles.context-archive";

export const contextArchiveLayer = (storage: DurableObjectStorage) =>
  Layer.succeed(
    ContextArchive,
    ContextArchive.of({
      save: (archive) => Effect.sync(() => storage.kv.put(contextArchiveKey, archive)),
      read: () =>
        Effect.sync(() => {
          const stored: unknown = storage.kv.get(contextArchiveKey);

          return stored instanceof Uint8Array ? stored : null;
        }),
    }),
  );
