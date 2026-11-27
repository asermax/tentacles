import * as Cloudflare from "@alchemy.run/cloudflare";
import { Workspace } from "@tentacles/contracts/workspace";
import { WorkspaceUnavailable } from "@tentacles/worker-api/errors";
import type { Settings } from "@tentacles/worker-api/settings";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { credentialPlaceholder, egressCaPath } from "./egress";

const InstanceTypes = {
  lite: "lite",
  basic: "basic",
  standard1: "standard-1",
  standard2: "standard-2",
  standard3: "standard-3",
  standard4: "standard-4",
} as const;

/** The one workspace image; custom images are not offered. */
export const defaultImage = "default";

/** The container the session's settings ask for: the one image and a Cloudflare instance type. */
export const ContainerSettings = Schema.Struct({
  image: Schema.Literal(defaultImage),
  size: Schema.Enum(InstanceTypes),
});

/** Why a session's settings name no container this setup can start. */
export const unsupportedSettings = (settings: Pick<Settings, "image" | "size">) =>
  `The workspace takes the image "${defaultImage}" and a Cloudflare instance type as its size; got image "${settings.image}" and size "${settings.size}"`;

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
