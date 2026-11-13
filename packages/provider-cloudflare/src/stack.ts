import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";

import { codemodeSandboxClass, codemodeWorkerName } from "./codemode-sandbox";
import { gatewayId } from "./model-providers";
import TentaclesWorker from "./worker";

/**
 * The whole Cloudflare setup: the AI Gateway, the codemode Worker, and the tentacles Worker, whose
 * init declares the session, registry and Claude objects, the containers, the cron, the secrets
 * and the AI and Browser bindings.
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

  const worker = yield* TentaclesWorker;

  return { api: worker.url, codemode: codemode.workerName };
});

/** The Alchemy providers the stack runs with. */
export const providers = Cloudflare.providers;
