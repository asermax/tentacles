import { defineDocFamily } from "@earendil-works/pi-durable";
import type { Parent } from "@tentacles/worker-api/parent";
import type { Settings } from "@tentacles/worker-api/settings";

// The status is not here: state.ts derives it from pi.live, the questions and
// the closed mark.
export type SessionRecord = {
  readonly name: string;
  readonly parent: Parent;
  readonly settings: Settings;
  closed: boolean;
  lastStopped: number | null;
};

// A family keyed by the session id, so create writes the whole record as the
// seed and no placeholder record ever exists.
export const RecordDoc = defineDocFamily<SessionRecord, SessionRecord>({
  family: true,
  kind: "tentacles.record",
  version: 1,
  scope: "session",
  initial: (seed) => seed,
  checkpointWhen: () => false,
});
