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

export class SessionObject extends DurableObjectBridge("SessionObject") {
  // Aborts the object, as an eviction or a crash does: the next call runs on a new instance.
  restart() {
    this.ctx.abort("restart");
  }

  // The tables the object's storage holds, which a delete empties.
  storedTables() {
    return this.ctx.storage.sql
      .exec(
        "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '_cf_%'",
      )
      .toArray()
      .map(({ name }) => name);
  }
}

export class RegistryObject extends DurableObjectBridge("RegistryObject") {}

export class ClaudeObject extends DurableObjectBridge("ClaudeObject") {}
