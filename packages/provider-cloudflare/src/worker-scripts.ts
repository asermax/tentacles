import type { Input } from "alchemy/Input";
import * as Context from "effect/Context";

import { codemodeWorkerName } from "./codemode-sandbox";
import { workspaceWorkerName } from "./workspace-names";

/**
 * The script names of the Workers whose Durable Object classes the tentacles Worker binds. The
 * stack provides the other Workers' outputs, so Alchemy deploys those Workers first. Inside the
 * running Worker the names are the plain constants, since the bindings are not read there.
 */
export const WorkerScripts = Context.Reference<{
  readonly codemode: Input<string>;
  readonly workspace: Input<string>;
}>("tentacles/WorkerScripts", {
  defaultValue: () => ({ codemode: codemodeWorkerName, workspace: workspaceWorkerName }),
});
