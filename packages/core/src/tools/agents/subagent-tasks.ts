import { Anchor } from "./subagent-anchor";
import { Reporter } from "./subagent-reporter";

/** The tasks the subagent tool creates; installed with it so they resume after a restart. */
export const subagentTasks = [Anchor, Reporter];
