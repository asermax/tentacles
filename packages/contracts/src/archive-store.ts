import type { ArchiveKind } from "@tentacles/worker-api/archive-kinds";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

// Each kind's archive exactly as the spawn sent it, kept in the provider's
// session storage until the workspace's cold start expands it. `read` answers
// null when the spawn sent none of that kind.
export class ArchiveStore extends Context.Service<
  ArchiveStore,
  {
    readonly save: (kind: ArchiveKind, archive: Uint8Array) => Effect.Effect<void>;
    readonly read: (kind: ArchiveKind) => Effect.Effect<Uint8Array | null>;
  }
>()("tentacles/ArchiveStore") {}
