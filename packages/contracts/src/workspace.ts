import type { Connection } from "@earendil-works/pi-env";
import type { Settings } from "@tentacles/worker-api/settings";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

// One session's workspace container. `ensure` runs before every tool use with
// the session's settings: when the container is not running it starts it from
// their image, size and lifetime, waits until pi-env's daemon answers and
// clones their repository into /workspace; a null repository starts the
// container only.
// Every tool, the clone and the git checks run through `connection`. There is
// no lifetime member: keeping the container up is the provider's mechanism.
/** Where the agent works; the Workspace implementation clones the repository here. */
export const workspaceDirectory = "/workspace";

/** Where the skills archive expands in the workspace container. */
export const skillsDirectory = "/skills";

/** Where the context archive expands in the workspace container. */
export const contextDirectory = "/context";

/** The session's settings a workspace starts from. */
export type WorkspaceSettings = Pick<Settings, "repository" | "image" | "size" | "lifetime">;

/** The workspace could not be started or its repository cloned. */
export class WorkspaceUnavailable extends Schema.TaggedError<WorkspaceUnavailable>()(
  "WorkspaceUnavailable",
  { message: Schema.String },
) {}

export class Workspace extends Context.Service<
  Workspace,
  {
    readonly ensure: (settings: WorkspaceSettings) => Effect.Effect<void, WorkspaceUnavailable>;
    readonly connection: () => Effect.Effect<Connection>;
    readonly forward: (port: number, request: Request) => Effect.Effect<Response>;
    /** Whether the container is running now; never starts it. */
    readonly isRunning: () => Effect.Effect<boolean>;
  }
>()("tentacles/Workspace") {}
