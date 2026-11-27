import type { ToolRegistration } from "@earendil-works/pi-durable";
import { workspaceDirectory } from "@tentacles/worker-api/archive-kinds";
import type { ArchiveEntry } from "@tentacles/worker-api/archives";
import type { Settings } from "@tentacles/worker-api/settings";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { WorkspaceSetupError } from "@tentacles/worker-api/errors";

/** Where the workspace clones the session's repository. */
export const repositoryDirectory = `${workspaceDirectory}/repo`;

/**
 * What a workspace is set up from: the session's repository, image and size,
 * and the files of the spawn's skills and context archives, already read and
 * validated; a kind the spawn did not send is empty.
 */
export interface WorkspaceInit extends Pick<Settings, "repository" | "image" | "size"> {
  readonly skills: ReadonlyArray<ArchiveEntry>;
  readonly context: ReadonlyArray<ArchiveEntry>;
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
    readonly create: (init: WorkspaceInit) => Effect.Effect<void, WorkspaceSetupError>;
    readonly forward: (port: number, request: Request) => Effect.Effect<Response>;
  }
>()("tentacles/Workspace") {}
