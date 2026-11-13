import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

// The skills archive exactly as the spawn sent it, kept in the provider's
// session storage until the workspace's cold start expands it. `read` answers
// null when the spawn sent no skills.
export class SkillsArchive extends Context.Service<
  SkillsArchive,
  {
    readonly save: (archive: Uint8Array) => Effect.Effect<void>;
    readonly read: () => Effect.Effect<Uint8Array | null>;
  }
>()("tentacles/SkillsArchive") {}
