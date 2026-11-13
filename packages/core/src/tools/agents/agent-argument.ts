import { opt, str } from "@earendil-works/pi-schema";

export const agentArgument = opt(
  str({
    description:
      "An agent name from available_agents; the subagent starts with that agent's prompt as its instructions.",
  }),
);
