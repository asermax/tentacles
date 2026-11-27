import type { ToolRegistration } from "@earendil-works/pi-durable";
import { workspaceDirectory } from "@tentacles/worker-api/archive-kinds";
import type { Settings } from "@tentacles/worker-api/settings";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { InvalidWorkspace, WorkspaceUnavailable } from "@tentacles/worker-api/errors";

/** Where the workspace clones the session's repository. */
export const repositoryDirectory = `${workspaceDirectory}/repo`;

/**
 * What a workspace is set up from: the session's repository, image and size,
 * and the spawn's skills and context archives exactly as it sent them, null
 * when it sent none of that kind.
 */
export interface WorkspaceInit extends Pick<Settings, "repository" | "image" | "size"> {
  readonly skills: Uint8Array | null;
  readonly context: Uint8Array | null;
}

// One session's workspace, as a provider fills it. `tools` are the tools the
// harness installs as they are, on every instance, before and after `create`.
// `create` runs once, at spawn: it clones the repository into
// repositoryDirectory and writes the archives into their kinds' directories,
// and on failure leaves nothing behind. `forward` answers with the app's response,
// or 502 when nothing listens on the port.
export class Workspace extends Context.Service<
  Workspace,
  {
    readonly tools: ReadonlyArray<ToolRegistration>;
    readonly create: (
      init: WorkspaceInit,
    ) => Effect.Effect<void, InvalidWorkspace | WorkspaceUnavailable>;
    readonly forward: (port: number, request: Request) => Effect.Effect<Response>;
  }
>()("tentacles/Workspace") {}
