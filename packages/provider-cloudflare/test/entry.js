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
  constructor(state, env) {
    super(withSpeedUpAlarm(state), env);
  }

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

// What the Worker writes with console.error, which is where the Claude provider logs a failed call.
const loggedErrors = [];
const realConsoleError = console.error;

console.error = (...args) => {
  loggedErrors.push(args.map(String).join(" "));
  realConsoleError(...args);
};

// A test can run the Worker's clock faster: Date.now advances scale times as fast, and timers wait
// scale times less, so a wait pi-durable makes on the harness clock, such as a retry's backoff,
// passes in a fraction of the time and still ends once the clock reaches it.
const realDateNow = Date.now;
const realClock = { scale: 1, realAt: 0, fakeAt: 0 };
let clock = realClock;

Date.now = () => clock.fakeAt + (realDateNow() - clock.realAt) * clock.scale;

// Alarms run on Miniflare's real clock, and pi-durable has the session object's alarm wake a task
// that sleeps until a time on the harness clock, so the object sets the alarm at the real time the
// sped-up time falls on.
const inRealTime = (at) => clock.realAt + (at - clock.fakeAt) / clock.scale;

const withSpeedUpAlarm = (state) => {
  const { storage } = state;
  const setAlarm = storage.setAlarm.bind(storage);

  storage.setAlarm = (at, options) => setAlarm(inRealTime(at), options);

  return state;
};

// An alarm pass of the Claude object waits keepAliveWait before it sets the next alarm; the wait
// is shortened here so a test does not wait it out. Effect's sleep reads setTimeout when it runs.
const realSetTimeout = globalThis.setTimeout;

globalThis.setTimeout = (callback, delay, ...args) =>
  realSetTimeout(callback, delay === keepAliveWait ? 20 : delay / clock.scale, ...args);

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
    loggedErrors.length = 0;
    clock = realClock;

    await this.ctx.storage.deleteAll();
    await this.ctx.storage.deleteAlarm();
  }

  speedUpTime(scale) {
    const now = realDateNow();

    clock = { scale, realAt: now, fakeAt: now };
  }

  // Puts the clock back on real time, which is earlier than the sped-up one.
  restoreTime() {
    clock = realClock;
  }

  // Moves the clock forward by the given time, as if it had passed.
  advanceTime(ms) {
    clock = { scale: clock.scale, realAt: realDateNow(), fakeAt: Date.now() + ms };
  }

  // What the object did to the container, and what its relay received.
  containerState() {
    return fakeContainer.snapshot();
  }

  workerErrors() {
    return [...loggedErrors];
  }

  // The container ends on its own: it stops running and every monitor() settles. Returns once the
  // object has had time to see the stop and forget its calls.
  async stopContainer() {
    fakeContainer.stop();

    await scheduler.wait(50);
  }

  // The container stops running, and its monitors are still open: the object has not seen the stop yet.
  vanishContainer() {
    fakeContainer.vanish();
  }

  // The calls the object keeps in its storage under its own keys. Only the test of a new instance
  // taking up an earlier instance's calls reads and writes them; every other test goes through the
  // relay's answers, the end reports, the clock and the alarm.
  storedCallIds() {
    return [...this.ctx.storage.kv.list({ prefix: "call:" })].map(([key]) =>
      key.slice("call:".length),
    );
  }

  storeCall(callId) {
    this.ctx.storage.kv.put(`call:${callId}`, Date.now());
  }

  alarmAt() {
    return this.ctx.storage.getAlarm();
  }

  // One alarm pass, as the platform would run it.
  async runAlarm() {
    await this.ctx.storage.deleteAlarm();

    return this.alarm();
  }
}
