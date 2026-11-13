import { SkillsArchive } from "@tentacles/contracts/skills-archive";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const skillsArchiveKey = "tentacles.skills-archive";

export const skillsArchiveLayer = (storage: DurableObjectStorage) =>
  Layer.succeed(
    SkillsArchive,
    SkillsArchive.of({
      save: (archive) => Effect.sync(() => storage.kv.put(skillsArchiveKey, archive)),
      read: () =>
        Effect.sync(() => {
          const stored: unknown = storage.kv.get(skillsArchiveKey);

          return stored instanceof Uint8Array ? stored : null;
        }),
    }),
  );
