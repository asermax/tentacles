// The Worker's main module as Alchemy generates it at deploy, which is JavaScript the bundler
// writes: the Worker bridge as the default export and one bridge class per Durable Object the
// Worker hosts.
import { makeDurableObjectBridge, makeWorkerBridge } from "@alchemy.run/cloudflare";
import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";

import { keepAliveWait } from "../src/claude-object.ts";
import TentaclesWorker from "../src/worker.ts";
import { createFakeContainer } from "./fake-container.ts";

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

const fakeContainer = createFakeContainer();

// An alarm pass of the Claude object waits keepAliveWait before it sets the next alarm; the wait
// is shortened here so a test does not wait it out. Effect's sleep reads setTimeout when it runs.
const realSetTimeout = globalThis.setTimeout;

globalThis.setTimeout = (callback, delay, ...args) =>
  realSetTimeout(callback, delay === keepAliveWait ? 20 : delay, ...args);

// The Claude object reads ctx.container; the fake takes its place, so no container starts.
const withFakeContainer = (state) => {
  Object.defineProperty(state, "container", { value: fakeContainer.container, configurable: true });

  return state;
};

export class ClaudeObject extends DurableObjectBridge("ClaudeObject") {
  constructor(state, env) {
    super(withFakeContainer(state), env);
  }

  // Aborts the object: the next call runs on a new instance that finds the container as it is.
  restart() {
    this.ctx.abort("restart");
  }

  // Puts the fake container in the given state and empties the object's storage and alarm.
  async reset(setup) {
    fakeContainer.reset(setup);

    await this.ctx.storage.deleteAll();
    await this.ctx.storage.deleteAlarm();
  }

  // What the object did to the container, and what its relay received.
  containerState() {
    return fakeContainer.snapshot();
  }

  // The container ends on its own: it stops running and every monitor() settles.
  stopContainer() {
    fakeContainer.stop();
  }

  // The count of calls in flight, the stopping mark and the last activity the object stored.
  storedCalls() {
    const { kv } = this.ctx.storage;

    return {
      callIds: [...kv.list({ prefix: "call:" })].map(([key]) => key.slice("call:".length)),
      isStopping: kv.get("isStopping") === true,
      lastActivity: kv.get("lastActivity") ?? null,
    };
  }

  storeCall(callId) {
    this.ctx.storage.kv.put(`call:${callId}`, Date.now());
  }

  storeStopping() {
    this.ctx.storage.kv.put("isStopping", true);
  }

  // Moves the last activity the given time into the past.
  storeLastActivity(agoMs) {
    this.ctx.storage.kv.put("lastActivity", Date.now() - agoMs);
  }

  alarmAt() {
    return this.ctx.storage.getAlarm();
  }

  // One alarm pass, as the platform would run it.
  runAlarm() {
    return this.alarm();
  }
}
