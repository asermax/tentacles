import { fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "@effect/vitest";
import { RegistryStore } from "@tentacles/contracts/registry-store";
import { Entry } from "@tentacles/worker-api/entries";
import { SessionState } from "@tentacles/worker-api/session-state";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";

import { eventually } from "./support/eventually";
import { definitionArchives, definitionNames } from "./support/archives";
import { createRequest, detailsOf, parent } from "./support/fixtures";
import { heldAnswer } from "./support/model";
import { BrowserCalls, newSessionId, TestWorld, testWorld } from "./support/world";

const details = detailsOf(createRequest(""), definitionNames);

const running = SessionState.cases.running.make(details);

/** A second from now: every stop recorded so far is before it. */
const soon = Clock.currentTimeMillis.pipe(Effect.map((now) => now + 1000));
const closed = SessionState.cases.closed.make(details);

const startSession = (prompt = "start") =>
  Effect.gen(function* () {
    const world = yield* TestWorld;
    const sessionId = newSessionId();
    const handle = yield* world.handle(sessionId);

    yield* handle.create(createRequest(prompt, null, yield* definitionArchives()));

    return { world, sessionId, handle, records: world.records(sessionId) };
  });

const idleAfter = (answer: string) =>
  SessionState.cases.idle.make({ ...details, lastEntry: Entry.cases.text.make({ text: answer }) });

describe("a session's lifecycle and status", () => {
  it.live("create stores the session, adds its entry and reports running once the run starts", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const held = heldAnswer("done");

      world.faux.setResponses([held.response]);

      const { sessionId, records } = yield* startSession("fix the build");

      expect(world.registryCalls).toEqual([`add ${sessionId}`, `running ${sessionId}`]);
      expect(records.states).toEqual([running]);
      expect(yield* (yield* RegistryStore).list(parent)).toEqual([
        { sessionId, name: "worker", status: "running", ...details },
      ]);

      held.release();

      yield* eventually(
        Effect.sync(() => expect(records.states).toEqual([running, idleAfter("done")])),
      );
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a follow-up during a run waits for its answer and keeps the session running", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const held = heldAnswer("first");

      world.faux.setResponses([held.response, fauxAssistantMessage("second")]);

      const { handle, records } = yield* startSession();

      yield* handle.prompt({ text: "and then this", mode: "followUp" });
      held.release();

      yield* eventually(
        Effect.sync(() => expect(records.states).toEqual([running, idleAfter("second")])),
      );
      expect(yield* handle.messages(4)).toEqual([
        Entry.cases.prompt.make({ text: "start" }),
        Entry.cases.text.make({ text: "first" }),
        Entry.cases.prompt.make({ text: "and then this" }),
        Entry.cases.text.make({ text: "second" }),
      ]);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a steer during a run joins it and keeps the session running", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const held = heldAnswer("first");

      world.faux.setResponses([held.response, fauxAssistantMessage("steered")]);

      const { handle, records } = yield* startSession();

      yield* handle.prompt({ text: "use pnpm", mode: "steer" });
      held.release();

      yield* eventually(
        Effect.sync(() => expect(records.states).toEqual([running, idleAfter("steered")])),
      );
      expect(yield* handle.messages(10)).toContainEqual(
        Entry.cases.prompt.make({ text: "use pnpm" }),
      );
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a prompt on an idle session starts a new run and clears the registry's stop time", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const registry = yield* RegistryStore;

      world.faux.setResponses([fauxAssistantMessage("first")]);

      const { sessionId, handle, records } = yield* startSession();

      yield* eventually(
        Effect.sync(() => expect(records.states).toEqual([running, idleAfter("first")])),
      );
      expect(yield* registry.stoppedBefore(yield* soon)).toEqual([sessionId]);

      const held = heldAnswer("second");

      world.faux.setResponses([held.response]);
      yield* handle.prompt({ text: "again", mode: "followUp" });

      yield* eventually(
        Effect.sync(() => expect(records.states).toEqual([running, idleAfter("first"), running])),
      );
      expect(yield* registry.stoppedBefore(yield* soon)).toEqual([]);
      held.release();
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a prompt on a failed session starts a new run that no longer shows the failure", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([
        fauxAssistantMessage("", { stopReason: "error", errorMessage: "rejected" }),
      ]);

      const { handle, records } = yield* startSession();

      const failed = SessionState.cases.failed.make({
        ...details,
        failure: "model_error: rejected",
      });

      yield* eventually(Effect.sync(() => expect(records.states).toEqual([running, failed])));

      const held = heldAnswer("recovered");

      world.faux.setResponses([held.response]);
      yield* handle.prompt({ text: "try again", mode: "followUp" });

      yield* eventually(
        Effect.sync(() => expect(records.states).toEqual([running, failed, running])),
      );
      expect(yield* handle.status()).toEqual(running);
      held.release();
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a prompt on a closed session reopens it with a new run", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([fauxAssistantMessage("first")]);

      const { sessionId, handle, records } = yield* startSession();

      yield* eventually(Effect.sync(() => expect(records.states).toHaveLength(2)));
      yield* handle.close();

      const held = heldAnswer("reopened");

      world.faux.setResponses([held.response]);
      yield* handle.prompt({ text: "one more thing", mode: "steer" });

      yield* eventually(
        Effect.sync(() =>
          expect(records.states).toEqual([running, idleAfter("first"), closed, running]),
        ),
      );
      expect((yield* (yield* RegistryStore).list(parent)).map((ref) => ref.status)).toEqual([
        "running",
      ]);
      expect(world.registryCalls.at(-1)).toBe(`running ${sessionId}`);
      held.release();
    }).pipe(Effect.provide(testWorld)),
  );

  it.live(
    "a finished run reports idle with its last entry, records the stop and closes the browser",
    () =>
      Effect.gen(function* () {
        const world = yield* TestWorld;
        const registry = yield* RegistryStore;
        const held = heldAnswer("all done");

        world.faux.setResponses([held.response]);

        const { sessionId, records } = yield* startSession();
        const preview = yield* registry.openPreview(sessionId, 3000);

        held.release();

        yield* eventually(
          Effect.sync(() => expect(records.states).toEqual([running, idleAfter("all done")])),
        );
        expect(world.registryCalls.at(-1)).toBe(`idle ${sessionId}`);
        expect(yield* registry.stoppedBefore(yield* soon)).toEqual([sessionId]);
        expect(yield* registry.resolvePreview(preview.token)).toBeNull();
        expect(records.browser).toEqual([BrowserCalls.close]);
      }).pipe(Effect.provide(testWorld)),
  );

  it.live("a failed run reports the failure pi-durable recorded and closes the browser", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([
        fauxAssistantMessage("", { stopReason: "error", errorMessage: "unknown model" }),
      ]);

      const { sessionId, records } = yield* startSession();

      yield* eventually(
        Effect.sync(() =>
          expect(records.states).toEqual([
            running,
            SessionState.cases.failed.make({ ...details, failure: "model_error: unknown model" }),
          ]),
        ),
      );
      expect(world.registryCalls.at(-1)).toBe(`failed ${sessionId}`);
      expect(records.browser).toEqual([BrowserCalls.close]);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("closing a running session aborts the run and reports closed, not failed", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const held = heldAnswer("never seen");

      world.faux.setResponses([held.response]);

      const { sessionId, handle, records } = yield* startSession();

      yield* handle.close();

      yield* eventually(Effect.sync(() => expect(records.states).toEqual([running, closed])));
      expect(world.registryCalls.at(-1)).toBe(`closed ${sessionId}`);
      expect(records.browser).toEqual([BrowserCalls.close]);
      expect(yield* handle.status()).toEqual(closed);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("closing an idle session only marks it closed", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const registry = yield* RegistryStore;

      world.faux.setResponses([fauxAssistantMessage("done")]);

      const { sessionId, handle, records } = yield* startSession();

      yield* eventually(Effect.sync(() => expect(records.states).toHaveLength(2)));

      const stopTimeQuery = yield* soon;

      expect(yield* registry.stoppedBefore(stopTimeQuery)).toEqual([sessionId]);

      yield* handle.close();

      yield* eventually(
        Effect.sync(() => expect(records.states).toEqual([running, idleAfter("done"), closed])),
      );
      expect(records.browser).toEqual([BrowserCalls.close]);
      expect(world.faux.state.callCount).toBe(1);
      expect(yield* registry.stoppedBefore(stopTimeQuery)).toEqual([sessionId]);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("closing a closed session changes nothing and sends no state", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([fauxAssistantMessage("done")]);

      const { sessionId, handle, records } = yield* startSession();

      yield* eventually(Effect.sync(() => expect(records.states).toHaveLength(2)));
      yield* handle.close();
      yield* eventually(Effect.sync(() => expect(records.states).toHaveLength(3)));

      const calls = world.registryCalls.length;

      yield* handle.close();
      yield* Effect.sleep("50 millis");

      expect(records.states).toHaveLength(3);
      expect(world.registryCalls).toHaveLength(calls);
      expect(world.registryCalls.at(-1)).toBe(`closed ${sessionId}`);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a closed session keeps its messages and status readable", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([fauxAssistantMessage("the answer")]);

      const { handle, records } = yield* startSession("a question");

      yield* eventually(Effect.sync(() => expect(records.states).toHaveLength(2)));
      yield* handle.close();

      expect(yield* handle.status()).toEqual(closed);
      expect(yield* handle.messages(2)).toEqual([
        Entry.cases.prompt.make({ text: "a question" }),
        Entry.cases.text.make({ text: "the answer" }),
      ]);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a run evicted midway resumes on the next instance and reports no stop in between", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const held = heldAnswer("cut off");

      world.faux.setResponses([held.response, fauxAssistantMessage("resumed")]);

      const { sessionId, records } = yield* startSession();

      yield* eventually(Effect.sync(() => expect(world.faux.state.callCount).toBe(1)));
      yield* world.evict(sessionId);

      const revived = yield* world.handle(sessionId);

      yield* revived.wake();

      yield* eventually(
        Effect.sync(() => expect(records.states).toEqual([running, idleAfter("resumed")])),
      );
      expect(records.browser).toEqual([BrowserCalls.close]);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live(
    "the wake timer is set while pi-durable reports work and cleared once it reports none",
    () =>
      Effect.gen(function* () {
        const world = yield* TestWorld;
        const held = heldAnswer("done");

        world.faux.setResponses([held.response]);

        const { records } = yield* startSession();

        expect(records.wakes.at(-1)).toBeTypeOf("number");

        held.release();

        yield* eventually(Effect.sync(() => expect(records.states).toHaveLength(2)));
        yield* eventually(Effect.sync(() => expect(records.wakes.at(-1)).toBeNull()));
      }).pipe(Effect.provide(testWorld)),
  );
});
