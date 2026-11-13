import { SkillsArchive } from "@tentacles/contracts/skills-archive";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const skillsArchiveKey = "tentacles.skills-archive";

/** The session's skills archive as one value in the object's key-value storage. */
export const skillsArchiveLayer = (storage: DurableObjectStorage) =>
  Layer.succeed(
    SkillsArchive,
    SkillsArchive.of({
      save: (archive) => Effect.sync(() => storage.kv.put(skillsArchiveKey, archive)),
      read: () => Effect.sync(() => storage.kv.get<Uint8Array>(skillsArchiveKey) ?? null),
    }),
  );
