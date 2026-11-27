import { Workspace } from "@tentacles/contracts/workspace";
import type { SessionId } from "@tentacles/worker-api/ids";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Predicate from "effect/Predicate";

import { destroyedReason, failureOf } from "./workspace-failure";
import { previewPortHeader } from "./workspace-names";
import { workspaceTools } from "./workspace-tools";
import type { WorkspaceObject } from "./workspace-worker";

/**
 * One session's Workspace, which is its workspace object, reached by the session id. Computer's
 * client for that object is awaited once, before the tools are built; every other call reaches the
 * object through a stub of its own, since an object that resets itself breaks the stub that called
 * it. Forwarding a preview request hands it to the object, which makes the port's request over
 * plain HTTP from the path it receives.
 */
export const workspaceLayer = (
  workspaces: DurableObjectNamespace<WorkspaceObject>,
  sessionId: SessionId,
) => {
  const stub = () => workspaces.getByName(sessionId);

  return Layer.effect(
    Workspace,
    Effect.gen(function* () {
      const client = yield* Effect.promise(async () => {
        const { getWorkspace } = await import("@cloudflare/computer");

        return getWorkspace(stub());
      });

      const tools = yield* workspaceTools(client);

      return Workspace.of({
        tools,

        create: (init) => Effect.tryPromise({ try: () => stub().setup(init), catch: failureOf }),

        forward: (port, request) =>
          Effect.tryPromise(() => {
            const forwarded = new Request(request);

            forwarded.headers.set(previewPortHeader, String(port));

            return stub().fetch(forwarded);
          }).pipe(
            Effect.orElseSucceed(
              () => new Response(`Nothing answers on port ${port}`, { status: 502 }),
            ),
          ),
      });
    }),
  );
};

/** Destroys the session's workspace object, which rejects the call with its abort reason when it succeeds. */
export const destroyWorkspace = (
  workspaces: DurableObjectNamespace<WorkspaceObject>,
  sessionId: SessionId,
) =>
  Effect.tryPromise(() => workspaces.getByName(sessionId).destroy()).pipe(
    Effect.catchIf(
      (error) => Predicate.isError(error.cause) && error.cause.message === destroyedReason,
      () => Effect.void,
    ),
    Effect.orDie,
  );
