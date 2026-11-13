// The Worker's main module as Alchemy generates it at deploy, which is JavaScript the bundler
// writes: the Worker bridge as the default export and one bridge class per Durable Object the
// Worker hosts.
import { makeDurableObjectBridge, makeWorkerBridge } from "@alchemy.run/cloudflare";
import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";

import TentaclesWorker from "../src/worker.ts";

const meta = {
  entrypoint: TentaclesWorker,
  stack: { name: "tentacles", stage: "test" },
};

export default makeWorkerBridge(WorkerEntrypoint, meta);

const DurableObjectBridge = makeDurableObjectBridge(DurableObject, meta);

// The key-value entry the provider keeps the skills archive under, which no operation of the
// object returns, read through the bridge the way a test reaches it over RPC.
export class SessionObject extends DurableObjectBridge("SessionObject") {
  storedSkillsArchive() {
    return this.ctx.storage.kv.get("tentacles.skills-archive") ?? null;
  }
}

export class RegistryObject extends DurableObjectBridge("RegistryObject") {}

export class ClaudeObject extends DurableObjectBridge("ClaudeObject") {}
