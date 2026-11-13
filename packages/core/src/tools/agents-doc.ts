import { defineDoc } from "@earendil-works/pi-durable";
import type { Agent } from "@tentacles/worker-api/definitions";

// Apart from agents.ts, whose extension holds the subagent tool that reads it.
/** The session's agent definitions, written once at create. */
export const AgentsDoc = defineDoc<{ agents: Agent[] }>({
  kind: "tentacles.agents",
  version: 1,
  scope: "session",
  initial: () => ({ agents: [] }),
  checkpointWhen: () => false,
});
