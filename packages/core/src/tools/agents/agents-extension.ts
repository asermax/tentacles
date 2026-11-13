import { type ConversationId, defineExtension, type Extension } from "@earendil-works/pi-durable";

import { agentsSection } from "./agents-section";
import { subagentTasks } from "./subagent-tasks";
import { subagentTool } from "./subagent-tool";

/**
 * The session's agents: the section that lists them, the subagent tool and the
 * tasks it creates. `withheld` names the extensions a subagent goes without,
 * by the conversation that starts it.
 */
export const agentsExtension = (withheld: (caller: ConversationId) => readonly Extension[]) =>
  defineExtension({
    name: "tentacles-agents",
    sections: [agentsSection],
    tools: [subagentTool(withheld)],
    tasks: subagentTasks,
  });
