import {
  type ConversationId,
  defineExtension,
  type Extension,
  section,
} from "@earendil-works/pi-durable";
import type { Agent } from "@tentacles/worker-api/definitions";

import { AgentsDoc } from "./agents-doc.ts";
import { subagentTasks, subagentTool } from "./subagent.ts";

const listing = (agents: readonly Agent[]) =>
  "Agents are definitions of subagents. Pass an agent's name as the agent argument of the " +
  "subagent tool to start a subagent with that agent's instructions.\n\n" +
  agents
    .map(
      (agent) =>
        `<agent>\n<name>${agent.name}</name>\n<description>${agent.description}</description>\n</agent>`,
    )
    .join("\n");

/**
 * The session's agents: the section that lists them, the subagent tool and the
 * tasks it creates. `withheld` names the extensions a subagent goes without,
 * by the conversation that starts it.
 */
export const agentsExtension = (withheld: (caller: ConversationId) => readonly Extension[]) =>
  defineExtension({
    name: "tentacles-agents",
    sections: [
      section("available_agents", async (input, context) => {
        const agents = (await input.read.snapshot(AgentsDoc, context))?.agents ?? [];

        return agents.length === 0 ? undefined : listing(agents);
      }),
    ],
    tools: [subagentTool(withheld)],
    tasks: subagentTasks,
  });
