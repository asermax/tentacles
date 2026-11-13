import { section } from "@earendil-works/pi-durable";
import type { Agent } from "@tentacles/worker-api/definitions";

import { AgentsDoc } from "./agents-doc.ts";

const listing = (agents: readonly Agent[]) =>
  "Agents are definitions of subagents. Pass an agent's name as the agent argument of the " +
  "subagent tool to start a subagent with that agent's instructions.\n\n" +
  agents
    .map(
      (agent) =>
        `<agent>\n<name>${agent.name}</name>\n<description>${agent.description}</description>\n</agent>`,
    )
    .join("\n");

export const agentsSection = section("available_agents", async (input, context) => {
  const agents = (await input.read.snapshot(AgentsDoc, context))?.agents ?? [];

  return agents.length === 0 ? undefined : listing(agents);
});
