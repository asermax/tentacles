import { defineDoc } from "@earendil-works/pi-durable";

/** Whether the spawn sent context files; written once at create. */
export const ContextDoc = defineDoc<{ sent: boolean }>({
  kind: "tentacles.context",
  version: 1,
  scope: "session",
  initial: () => ({ sent: false }),
  checkpointWhen: () => false,
});
