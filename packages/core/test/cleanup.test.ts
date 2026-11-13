import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "@effect/vitest";
import { RegistryStore } from "@tentacles/contracts/registry-store";
import { SessionNotFound } from "@tentacles/worker-api/errors";
import type { SessionId } from "@tentacles/worker-api/ids";
import { SessionState } from "@tentacles/worker-api/session-state";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { cleanup } from "../src";
import { later } from "./support/clock";
import { eventually } from "./support/eventually";
import { createRequest, details, parent } from "./support/fixtures";
import { heldAnswer } from "./support/model";
import { newSessionId, TestWorld, testWorld } from "./support/world";

const afterAMonth = later("31 days");

/** A session whose run has stopped with the given state. */
const stoppedSession = (reaches: (state: SessionState | undefined) => boolean, isClosed = false) =>
  Effect.gen(function* () {
    const world = yield* TestWorld;
    const sessionId = newSessionId();
    const handle = yield* world.handle(sessionId);

    yield* handle.create(createRequest("work"));
    yield* eventually(
      Effect.sync(() => expect(reaches(world.records(sessionId).states.at(-1))).toBe(true)),
    );

    if (isClosed) {
      yield* handle.close();
    }

    return sessionId;
  });

const isIdle = (state: SessionState | undefined) =>
  state != null && SessionState.guards.idle(state);

const isFailed = (state: SessionState | undefined) =>
  state != null && SessionState.guards.failed(state);

const listed = Effect.flatMap(RegistryStore, (registry) => registry.list(parent)).pipe(
  Effect.map((refs) => refs.map((ref) => ref.sessionId)),
);

const statusOf = (sessionId: SessionId) =>
  Effect.flatMap(TestWorld, (world) =>
    Effect.flatMap(world.handle(sessionId), (handle) => handle.status()),
  );

describe("the daily cleanup", () => {
  it.live("deletes the sessions whose last run stopped over a month ago, without their alarm", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([
        fauxAssistantMessage("done"),
        fauxAssistantMessage("", { stopReason: "error", errorMessage: "invalid" }),
        fauxAssistantMessage("closed later"),
      ]);

      const idle = yield* stoppedSession(isIdle);
      const failed = yield* stoppedSession(isFailed);
      const closed = yield* stoppedSession(isIdle, true);

      expect(world.records(idle).wakes.at(-1)).toBeNull();

      yield* afterAMonth(cleanup);

      expect(yield* listed).toEqual([]);

      for (const sessionId of [idle, failed, closed]) {
        expect(yield* statusOf(sessionId).pipe(Effect.flip)).toEqual(
          new SessionNotFound({ sessionId }),
        );
      }
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("leaves recently stopped, running and waiting sessions alone", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const held = heldAnswer("still going");

      world.faux.setResponses([
        fauxAssistantMessage("done"),
        held.response,
        fauxAssistantMessage(fauxToolCall("ask_parent", { question: "Which?" }), {
          stopReason: "toolUse",
        }),
      ]);

      const recent = yield* stoppedSession(isIdle);

      const running = yield* stoppedSession(
        (state) => state != null && SessionState.guards.running(state),
      );

      const waiting = yield* stoppedSession(
        (state) => state != null && SessionState.guards.waiting(state),
      );

      yield* later("1 day")(cleanup);

      expect((yield* listed).toSorted()).toEqual([recent, running, waiting].toSorted());

      yield* afterAMonth(cleanup);

      expect((yield* listed).toSorted()).toEqual([running, waiting].toSorted());
      expect(yield* statusOf(running)).toEqual(SessionState.cases.running.make(details));
      expect(SessionState.guards.waiting(yield* statusOf(waiting))).toBe(true);
      held.release();
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("removes the entry of a session that is already gone", () =>
    Effect.gen(function* () {
      const registry = yield* RegistryStore;
      const sessionId = newSessionId();

      yield* registry.add(sessionId, "gone", parent, details);
      yield* registry.setStatus(sessionId, "running");
      yield* registry.setStatus(sessionId, "idle");

      yield* afterAMonth(cleanup);

      expect(yield* listed).toEqual([]);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("keeps the entry whose deletion failed and deletes the others", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([fauxAssistantMessage("one"), fauxAssistantMessage("two")]);

      const first = yield* stoppedSession(isIdle);
      const second = yield* stoppedSession(isIdle);

      world.failures.deleteOnce.add(first);

      yield* afterAMonth(cleanup);

      expect(yield* listed).toEqual([first]);
      expect(yield* statusOf(second).pipe(Effect.flip)).toEqual(
        new SessionNotFound({ sessionId: second }),
      );
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("ends without failing when the registry cannot list candidates", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.failures.stoppedBefore = true;

      expect(Exit.isSuccess(yield* Effect.exit(afterAMonth(cleanup)))).toBe(true);
    }).pipe(Effect.provide(testWorld)),
  );
});
