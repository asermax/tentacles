import { defineTask } from "@earendil-works/pi-durable";

// A child must outlive the call that spawned it, so a background task owns its
// conversation: the parent's abort and idle waits stop at it.
export const Anchor = defineTask<null, { phase: "done" }, null>({
  name: "tentacles.subagent-anchor",
  version: 1,
  initial: () => ({ phase: "done" }),
  phases: {
    done: (_anchor, runtime, context) =>
      runtime.commit(
        () => ({ status: "terminal", outcome: { status: "completed", result: null } }),
        context,
      ),
  },
  abort: (_anchor, runtime, context) =>
    runtime.commit(() => ({ status: "terminal", outcome: { status: "aborted" } }), context),
});
