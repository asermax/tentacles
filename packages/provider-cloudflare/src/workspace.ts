import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as Cloudflare from "@alchemy.run/cloudflare";
import { ALCHEMY_PHASE } from "alchemy";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { Connection, RemoteExecutionEnv } from "@earendil-works/pi-env";
import {
  Workspace,
  type WorkspaceSettings,
  WorkspaceUnavailable,
  workspaceDirectory,
} from "@tentacles/contracts/workspace";
import type { SessionId } from "@tentacles/worker-api/ids";
import type { Repository } from "@tentacles/worker-api/settings";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

import { credentialPlaceholder, EgressHosts, egressCaPath } from "./egress.ts";
import { registerExec } from "./spawn-shim.ts";

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
  lifetime: Schema.Int,
});

const decodeContainerSettings = Schema.decodeUnknownEffect(ContainerSettings);

/** Why a session's settings name no container this setup can start. */
export const unsupportedSettings = (settings: Pick<WorkspaceSettings, "image" | "size">) =>
  `The workspace takes the image "${defaultImage}" and a Cloudflare instance type as its size; got image "${settings.image}" and size "${settings.size}"`;

// The daemon in the image comes from the same pi-env release the Worker bundles, so its client and
// the daemon always speak the same protocol. Alchemy evaluates the container's props in the running
// Worker too, where no package.json exists and the build arguments are not used.
const readPiEnvVersion = Effect.promise(() =>
  readFile(
    join(dirname(fileURLToPath(import.meta.resolve("@earendil-works/pi-env"))), "../package.json"),
    "utf8",
  ),
).pipe(
  Effect.flatMap(
    Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Struct({ version: Schema.String }))),
  ),
  Effect.map((manifest) => manifest.version),
  Effect.orDie,
);

const piEnvVersion = Effect.flatMap(ALCHEMY_PHASE, (phase) =>
  phase === "runtime" ? Effect.succeed("") : readPiEnvVersion,
);

// The deploy publishes each class's images under their Container's id, and start names the one to
// run.
const workspaceContainerId = "WorkspaceContainer";

/** The workspace image, attached to the session object's class. */
export class WorkspaceContainer extends Cloudflare.Container<WorkspaceContainer>()(
  workspaceContainerId,
  Effect.gen(function* () {
    return {
      schedulingPolicy: "durable_object" as const,
      context: `${import.meta.dirname}/../images/workspace`,
      build: {
        args: {
          PI_ENV_VERSION: yield* piEnvVersion,
          EGRESS_CA_PATH: egressCaPath,
          CREDENTIAL_PLACEHOLDER: credentialPlaceholder,
        },
      },
    };
  }),
) {}

const unavailable = (cause: unknown) => new WorkspaceUnavailable({ message: String(cause) });

const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

// --depth alone implies --single-branch, which leaves a pushed new branch without a remote-tracking
// ref, so the pending-work check would count its commits as not pushed.
const cloneCommand = (repository: Repository) =>
  [
    "git clone",
    repository.shallow ? "--depth 1 --no-single-branch" : "",
    "--",
    shellQuote(repository.url),
    workspaceDirectory,
  ]
    .filter((part) => part !== "")
    .join(" ");

export interface WorkspaceHandles {
  readonly sessionId: SessionId;
  readonly container: () => Container;
  /** The Worker's default entrypoint with this session's egress props. */
  readonly egress: Fetcher;
}

/**
 * One session's workspace on the session object's container. pi-env's daemon runs in it over
 * ctx.container.exec, through the spawn shim.
 */
export const workspaceLayer = ({ sessionId, container, egress }: WorkspaceHandles) => {
  const program = `container-exec:${sessionId}`;

  registerExec(program, (args) =>
    container().exec(["/usr/local/bin/pi-env", ...args], {
      stdin: "pipe",
      cwd: workspaceDirectory,
    }),
  );

  const connection = new Connection({ command: [program] });

  const env = new RemoteExecutionEnv({
    connection,
    id: `workspace:${sessionId}`,
    cwd: workspaceDirectory,
  });

  // Right after a deploy the container application can still be provisioning, and the first
  // starts fail; the daemon answering is what ready means.
  const daemonReady = Effect.tryPromise({ try: () => connection.info(), catch: unavailable }).pipe(
    Effect.retry({ schedule: Schedule.spaced("2 seconds"), times: 15 }),
  );

  const clone = (repository: Repository) =>
    Effect.tryPromise({
      try: () => env.exec(cloneCommand(repository), undefined, BACKGROUND_CONTEXT),
      catch: unavailable,
    }).pipe(
      Effect.flatMap((result) =>
        result.ok && result.value.exitCode === 0
          ? Effect.void
          : Effect.fail(
              new WorkspaceUnavailable({
                message: `Cloning ${repository.url} into the workspace failed`,
              }),
            ),
      ),
    );

  // Concurrent tool calls share one start and one clone.
  const starting = Semaphore.makeUnsafe(1);

  const start = (settings: WorkspaceSettings) =>
    Effect.gen(function* () {
      const { size, lifetime } = yield* decodeContainerSettings(settings).pipe(
        Effect.mapError(() => new WorkspaceUnavailable({ message: unsupportedSettings(settings) })),
      );

      const image = yield* Effect.fromNullishOr(container().images[workspaceContainerId]).pipe(
        Effect.mapError(
          () => new WorkspaceUnavailable({ message: "The deploy published no workspace image" }),
        ),
      );

      yield* Effect.try({
        try: () =>
          container().start({
            image,
            instance: size,
            enableInternet: true,
          }),
        catch: unavailable,
      });

      // The interceptors do not survive a restart, so they are set after every start.
      yield* Effect.tryPromise({
        try: () =>
          Promise.all([
            container().setInactivityTimeout(lifetime * 60_000),
            container().interceptOutboundHttps(EgressHosts.github, egress),
            container().interceptOutboundHttp(EgressHosts.lifetime, egress),
          ]),
        catch: unavailable,
      });
    });

  return Layer.succeed(
    Workspace,
    Workspace.of({
      ensure: (settings) =>
        starting.withPermit(
          Effect.gen(function* () {
            if (container().running) {
              return;
            }

            yield* start(settings);
            yield* daemonReady;

            if (settings.repository != null) {
              yield* clone(settings.repository);
            }
          }),
        ),

      connection: () => Effect.succeed(connection),

      isRunning: () => Effect.sync(() => container().running),

      // The preview arrives over HTTPS, and the port's fetch would speak TLS to an app that serves
      // plain HTTP.
      forward: (port, request) =>
        Effect.tryPromise(() => {
          const url = new URL(request.url);

          url.protocol = "http:";

          return container().getTcpPort(port).fetch(new Request(url, request));
        }).pipe(
          Effect.orElseSucceed(
            () => new Response(`Nothing answers on port ${port}`, { status: 502 }),
          ),
        ),
    }),
  );
};
