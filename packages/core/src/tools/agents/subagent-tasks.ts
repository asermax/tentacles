import { Anchor } from "./subagent-anchor.ts";
import { Reporter } from "./subagent-reporter.ts";

/** The tasks the subagent tool creates; installed with it so they resume after a restart. */
export const subagentTasks = [Anchor, Reporter];
