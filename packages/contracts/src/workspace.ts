import type { Connection } from "@earendil-works/pi-env";
import type { Repository } from "@tentacles/worker-api/settings";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

// One session's workspace container, started from the session's image, size
// and lifetime. `ensure` runs before every tool use: when the container is not
// running it starts it, waits until pi-env's daemon answers and clones the
// repository into /workspace; a null repository starts the container only.
// Every tool, the clone and the git checks run through `connection`. There is
// no lifetime member: keeping the container up is the provider's mechanism.
export class Workspace extends Context.Service<
  Workspace,
  {
    readonly ensure: (repository: Repository | null) => Effect.Effect<void>;
    readonly connection: () => Effect.Effect<Connection>;
    readonly forward: (port: number, request: Request) => Effect.Effect<Response>;
    readonly stop: () => Effect.Effect<void>;
  }
>()("tentacles/Workspace") {}
