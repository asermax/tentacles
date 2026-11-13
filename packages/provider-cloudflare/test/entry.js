// The Worker's main module as Alchemy generates it at deploy, which is JavaScript the bundler
// writes: the Worker bridge as the default export and one bridge class per Durable Object the
// Worker hosts.
import { makeDurableObjectBridge, makeWorkerBridge } from "@alchemy.run/cloudflare";
import { ArchiveStore } from "@tentacles/contracts/archive-store";
import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";
import * as Effect from "effect/Effect";

import { archiveStoreLayer } from "../src/archive-store.ts";
import TentaclesWorker from "../src/worker.ts";

const meta = {
  entrypoint: TentaclesWorker,
  stack: { name: "tentacles", stage: "test" },
};

export default makeWorkerBridge(WorkerEntrypoint, meta);

const DurableObjectBridge = makeDurableObjectBridge(DurableObject, meta);

// The archives the provider stores, which no operation of the object returns, read through the
// provider's own layer the way a test reaches it over RPC.
export class SessionObject extends DurableObjectBridge("SessionObject") {
  storedArchive(kind) {
    return Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* ArchiveStore;

        return yield* store.read(kind);
      }).pipe(Effect.provide(archiveStoreLayer(this.ctx.storage))),
    );
  }
}

export class RegistryObject extends DurableObjectBridge("RegistryObject") {}

export class ClaudeObject extends DurableObjectBridge("ClaudeObject") {}
