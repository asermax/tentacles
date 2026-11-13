// The Worker's main module as Alchemy generates it at deploy, which is JavaScript the bundler
// writes: the Worker bridge as the default export and one bridge class per Durable Object the
// Worker hosts.
import { makeDurableObjectBridge, makeWorkerBridge } from "@alchemy.run/cloudflare";
import { ContextArchive } from "@tentacles/contracts/context-archive";
import { SkillsArchive } from "@tentacles/contracts/skills-archive";
import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";
import * as Effect from "effect/Effect";

import { contextArchiveLayer } from "../src/context-archive.ts";
import { skillsArchiveLayer } from "../src/skills-archive.ts";
import TentaclesWorker from "../src/worker.ts";

const meta = {
  entrypoint: TentaclesWorker,
  stack: { name: "tentacles", stage: "test" },
};

export default makeWorkerBridge(WorkerEntrypoint, meta);

const DurableObjectBridge = makeDurableObjectBridge(DurableObject, meta);

// The skills archive the provider stores, which no operation of the object returns, read through
// the provider's own layer the way a test reaches it over RPC.
export class SessionObject extends DurableObjectBridge("SessionObject") {
  storedSkillsArchive() {
    return Effect.runPromise(
      Effect.gen(function* () {
        const archive = yield* SkillsArchive;

        return yield* archive.read();
      }).pipe(Effect.provide(skillsArchiveLayer(this.ctx.storage))),
    );
  }

  storedContextArchive() {
    return Effect.runPromise(
      Effect.gen(function* () {
        const archive = yield* ContextArchive;

        return yield* archive.read();
      }).pipe(Effect.provide(contextArchiveLayer(this.ctx.storage))),
    );
  }
}

export class RegistryObject extends DurableObjectBridge("RegistryObject") {}

export class ClaudeObject extends DurableObjectBridge("ClaudeObject") {}
