import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

import { egressCaPath } from "./egress";
import { codemodeSandboxClass, codemodeWorkerName } from "./codemode-sandbox";
import { gatewayId } from "./model-providers";
import TentaclesWorker from "./worker";
import { WorkerScripts } from "./worker-scripts";
import {
  workspaceContainerId,
  workspaceLoaderBinding,
  workspaceObjectClass,
  workspaceWorkerName,
} from "./workspace-names";

// The workspace image: Computer's daemon, FUSE and the agent's tools. The deploy publishes it under
// the Container's id, which Computer's container backend starts by name.
const WorkspaceContainer = Cloudflare.Container(workspaceContainerId, {
  schedulingPolicy: "durable_object",
  context: `${import.meta.dirname}/../images/workspace`,
  build: { args: { EGRESS_CA_PATH: egressCaPath } },
});

/**
 * The whole Cloudflare setup: the AI Gateway, the codemode Worker, the Workspace Worker, and the
 * tentacles Worker, whose init declares the session, registry and Claude objects, the Claude
 * container, the cron, the secrets and the AI and Browser bindings.
 */
export const stack = Effect.gen(function* () {
  yield* Cloudflare.AI.Gateway("Gateway", { id: gatewayId });

  // A Worker of its own, so codemode scripts never run on a session object's thread. The tentacles
  // Worker binds its class by script name; Cloudflare checks the class exists when that binding is
  // uploaded, so this Worker has to be in place first.
  const codemode = yield* Cloudflare.Worker("CodemodeWorker", {
    name: codemodeWorkerName,
    main: `${import.meta.dirname}/codemode-worker.ts`,
    env: { [codemodeSandboxClass]: Cloudflare.DurableObject(codemodeSandboxClass) },
  });

  // The Worker that holds every session's workspace object and its container, with the egress
  // gateway and the secrets the git client and the gateway use. Its main module is hand-written,
  // because Computer's mixin and named exports cannot go through Alchemy's generated class.
  const workspace = yield* Cloudflare.Worker("WorkspaceWorker", {
    name: workspaceWorkerName,
    main: `${import.meta.dirname}/workspace-worker.ts`,
    compatibility: { date: "2026-08-11", flags: ["nodejs_compat"] },
    observability: { enabled: true },
    env: {
      [workspaceObjectClass]: Cloudflare.DurableObject(workspaceObjectClass, {
        containers: [WorkspaceContainer],
      }),
      [workspaceLoaderBinding]: Cloudflare.WorkerLoader(workspaceLoaderBinding),
      TENTACLES_GITHUB_TOKEN: Config.Redacted("TENTACLES_GITHUB_TOKEN"),
      TENTACLES_GIT_AUTHOR_NAME: Config.String("TENTACLES_GIT_AUTHOR_NAME"),
      TENTACLES_GIT_AUTHOR_EMAIL: Config.String("TENTACLES_GIT_AUTHOR_EMAIL"),
    },
  });

  const worker = yield* TentaclesWorker.pipe(
    Effect.provideService(WorkerScripts, {
      codemode: codemode.workerName,
      workspace: workspace.workerName,
    }),
  );

  return { api: worker.url, codemode: codemode.workerName, workspace: workspace.workerName };
});

/** The Alchemy providers the stack runs with. */
export const providers = Cloudflare.providers;
