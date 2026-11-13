import type { Context } from "@earendil-works/chord/context";
import type { ToolExecutionApi } from "@earendil-works/pi-durable";

import { findNamed } from "../find-named";
import { AgentsDoc } from "./agents-doc";

// The agent a call names, or null when it names none.
export const agentNamed = async (
  name: string | undefined,
  api: Pick<ToolExecutionApi, "snapshot">,
  context: Context,
) => {
  if (name == null) {
    return null;
  }

  const agents = (await api.snapshot(AgentsDoc, context))?.agents ?? [];

  return findNamed({ singular: "agent", plural: "Agents" }, agents, name);
};
