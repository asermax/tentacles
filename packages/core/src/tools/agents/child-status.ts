import type { LiveState } from "@earendil-works/pi-durable";

export const childStatus = (live: Readonly<LiveState> | undefined) => {
  if (live?.run != null) {
    return "running";
  }

  if (live?.runFailure == null) {
    return "idle";
  }

  return live.runFailure.reason === "aborted" ? "stopped" : "failed";
};
