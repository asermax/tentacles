import type { SessionId } from "@tentacles/worker-api/ids";
import type { Parent } from "@tentacles/worker-api/parent";
import type {
  SessionDetails,
  SessionListing,
  SessionStatus,
} from "@tentacles/worker-api/session-state";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import type { PreviewToken } from "./preview-router.ts";

export interface OpenedPreview {
  readonly token: PreviewToken;
}

/** The store could not be read or written. */
export class RegistryUnavailable extends Schema.TaggedError<RegistryUnavailable>()(
  "RegistryUnavailable",
  { message: Schema.String },
) {}

export interface PreviewTarget {
  readonly sessionId: SessionId;
  readonly port: number;
}

// The one store across sessions: an entry per session with its parent, its
// details (settings, skill and agent names), the time its last run stopped and
// its preview. `add` leaves the entry without a
// status until the first `setStatus`. `setStatus` derives the rest from the
// transition: a run that stops sets lastStopped and clears the preview, a stop
// that follows a stop keeps lastStopped, and a new run clears it.
// `stoppedBefore` takes epoch milliseconds; running and waiting sessions never
// have lastStopped set. Closing a preview when none is open is not an error.
export class RegistryStore extends Context.Service<
  RegistryStore,
  {
    readonly add: (
      sessionId: SessionId,
      name: string,
      parent: Parent,
      details: SessionDetails,
    ) => Effect.Effect<void, RegistryUnavailable>;
    readonly setStatus: (
      sessionId: SessionId,
      status: SessionStatus,
    ) => Effect.Effect<void, RegistryUnavailable>;
    readonly list: (
      parent: Parent,
    ) => Effect.Effect<ReadonlyArray<SessionListing>, RegistryUnavailable>;
    readonly remove: (sessionId: SessionId) => Effect.Effect<void, RegistryUnavailable>;
    readonly openPreview: (
      sessionId: SessionId,
      port: number,
    ) => Effect.Effect<OpenedPreview, RegistryUnavailable>;
    readonly resolvePreview: (
      token: PreviewToken,
    ) => Effect.Effect<PreviewTarget | null, RegistryUnavailable>;
    readonly closePreview: (sessionId: SessionId) => Effect.Effect<void, RegistryUnavailable>;
    readonly stoppedBefore: (
      before: number,
    ) => Effect.Effect<ReadonlyArray<SessionId>, RegistryUnavailable>;
  }
>()("tentacles/RegistryStore") {}
