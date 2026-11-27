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

  // The tables of the object's storage that hold rows beyond pi-durable's schema bookkeeping, which
  // every new instance writes. A delete empties them, and the instance that follows it writes
  // only the bookkeeping.
  storedTables() {
    const { sql } = this.ctx.storage;

    return sql
      .exec(
        "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '_cf_%' and name not in ('durable_schema', 'durable_metadata')",
      )
      .toArray()
      .map(({ name }) => name)
      .filter((name) => sql.exec(`select count(*) as total from "${name}"`).one().total > 0);
  }
}

export class RegistryObject extends DurableObjectBridge("RegistryObject") {}

export class ClaudeObject extends DurableObjectBridge("ClaudeObject") {}
