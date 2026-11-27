import type { Input } from "alchemy/Input";
import * as Context from "effect/Context";

/**
 * The script names of the Workers whose Durable Object classes the tentacles Worker binds. They
 * are the other Workers' outputs, so the stack deploys those Workers first.
 */
export class WorkerScripts extends Context.Service<
  WorkerScripts,
  {
    readonly codemode: Input<string>;
    readonly workspace: Input<string>;
  }
>()("tentacles/WorkerScripts") {}
