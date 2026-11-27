import * as Cloudflare from "@alchemy.run/cloudflare";
import { Workspace } from "@tentacles/contracts/workspace";
import { WorkspaceUnavailable } from "@tentacles/worker-api/errors";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { credentialPlaceholder, egressCaPath } from "./egress";

// The deploy publishes each class's images under their Container's id.
const workspaceContainerId = "WorkspaceContainer";

/** The workspace image, attached to the session object's class. */
export class WorkspaceContainer extends Cloudflare.Container<WorkspaceContainer>()(
  workspaceContainerId,
  Effect.succeed({
    schedulingPolicy: "durable_object" as const,
    context: `${import.meta.dirname}/../images/workspace`,
    build: {
      args: {
        EGRESS_CA_PATH: egressCaPath,
        CREDENTIAL_PLACEHOLDER: credentialPlaceholder,
      },
    },
  }),
) {}

export interface WorkspaceHandles {
  readonly container: () => Container | undefined;
}

/** One session's workspace on the session object's container. */
export const workspaceLayer = ({ container: maybeContainer }: WorkspaceHandles) =>
  Layer.succeed(
    Workspace,
    Workspace.of({
      tools: [],

      create: () =>
        Effect.fail(
          new WorkspaceUnavailable({ message: "The workspace cannot be set up from this Worker" }),
        ),

      // The preview arrives over HTTPS, and the port's fetch would speak TLS to an app that serves
      // plain HTTP.
      forward: (port, request) =>
        Effect.tryPromise(() => {
          const container = maybeContainer();

          if (container == null) {
            throw new Error("The session object has no container");
          }

          const url = new URL(request.url);

          url.protocol = "http:";

          return container.getTcpPort(port).fetch(new Request(url, request));
        }).pipe(
          Effect.orElseSucceed(
            () => new Response(`Nothing answers on port ${port}`, { status: 502 }),
          ),
        ),
    }),
  );
