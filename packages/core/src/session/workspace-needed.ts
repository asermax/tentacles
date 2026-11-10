import { SessionState } from "@tentacles/worker-api/session-state";

// Pending work keeps a stopped session's workspace up for this long after the
// run stopped; then the container stops and the work is lost.
const graceMillis = 15 * 60_000;

const isActive = SessionState.isAnyOf(["running", "waiting"]);

/** The lifetime query: running or waiting, or pending work within 15 minutes of the stop. */
export const isWorkspaceNeeded = (
  state: SessionState,
  lastStopped: number | null,
  pendingWork: boolean,
  now: number,
) => isActive(state) || (pendingWork && lastStopped != null && now - lastStopped < graceMillis);
