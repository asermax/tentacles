import { Workspace } from "@tentacles/contracts/workspace";
import { WorkspaceUnavailable } from "@tentacles/worker-api/errors";
import type { SessionId } from "@tentacles/worker-api/ids";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { workspaceTools } from "./computer/workspace-tools";
import { decodeSetupResult } from "./workspace-failure";
import { previewPortHeader } from "./workspace-names";
import type { WorkspaceObject } from "./workspace-worker";

/**
 * One session's Workspace, which is its workspace object, reached by the session id through one
 * stub. Computer's client for that object is awaited once, before the tools are built. The setup
 * answers its failure as data, which this decodes into the typed error. Forwarding a preview request
 * hands it to the object, which makes the port's request over plain HTTP from the path it receives.
 */
export const workspaceLayer = (
  workspaces: DurableObjectNamespace<WorkspaceObject>,
  sessionId: SessionId,
) =>
  Layer.effect(
    Workspace,
    Effect.gen(function* () {
      const workspaceStub = workspaces.getByName(sessionId);

      const workspaceClient = yield* Effect.promise(async () => {
        const { getWorkspace } = await import("@cloudflare/computer");

        return getWorkspace(workspaceStub);
      });

      const tools = yield* workspaceTools(workspaceClient);

      return Workspace.of({
        tools,

        create: (init) =>
          Effect.tryPromise({
            try: async () => await workspaceStub.setUpWorkspace(init),
            catch: (cause) =>
              new WorkspaceUnavailable({
                message: `Setting up the workspace failed: ${String(cause)}`,
              }),
          }).pipe(
            Effect.flatMap((result) => decodeSetupResult(result).pipe(Effect.orDie)),
            Effect.flatMap((failure) => (failure == null ? Effect.void : Effect.fail(failure))),
          ),

        forward: (port, request) =>
          Effect.tryPromise(() => {
            const forwardedRequest = new Request(request);

            forwardedRequest.headers.set(previewPortHeader, String(port));

            return workspaceStub.fetch(forwardedRequest);
          }).pipe(
            Effect.orElseSucceed(
              () => new Response(`Nothing answers on port ${port}`, { status: 502 }),
            ),
          ),
      });
    }),
  );

/** Destroys the session's workspace object: its container, its alarm and its storage. */
export const destroyWorkspace = (
  workspaces: DurableObjectNamespace<WorkspaceObject>,
  sessionId: SessionId,
) => Effect.tryPromise(() => workspaces.getByName(sessionId).destroy()).pipe(Effect.orDie);
