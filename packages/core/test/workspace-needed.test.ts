import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "@effect/vitest";
import type { SessionState } from "@tentacles/worker-api/session-state";
import type { Repository } from "@tentacles/worker-api/settings";
import * as Effect from "effect/Effect";

import { later } from "./support/clock";
import { eventually } from "./support/eventually";
import { createRequest } from "./support/fixtures";
import { heldAnswer } from "./support/model";
import { bareRepository } from "./support/workspace";
import { newSessionId, TestWorld, testWorld } from "./support/world";

const ask = fauxAssistantMessage(fauxToolCall("ask_parent", { question: "Which?" }), {
  stopReason: "toolUse",
});

const startSession = (prompt: string, repository: "managed" | "none" = "managed") =>
  Effect.gen(function* () {
    const world = yield* TestWorld;
    const sessionId = newSessionId();
    const handle = yield* world.handle(sessionId);

    const managed: Repository | null =
      repository === "managed"
        ? { url: bareRepository(world.shared, sessionId), shallow: false }
        : null;

    yield* handle.create(createRequest(prompt, managed));

    return { handle, records: world.records(sessionId) };
  });

const reaching = (status: SessionState["_tag"], records: { readonly states: SessionState[] }) =>
  eventually(Effect.sync(() => expect(records.states.at(-1)).toMatchObject({ _tag: status })));

describe("whether the workspace is still needed", () => {
  it.live("a running session needs it", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const held = heldAnswer("done");

      world.faux.setResponses([held.response]);

      const { handle } = yield* startSession("work");

      expect(yield* handle.workspaceNeeded(false)).toBe(true);
      held.release();
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a waiting session needs it", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([ask]);

      const { handle, records } = yield* startSession("work");

      yield* reaching("waiting", records);
      expect(yield* handle.workspaceNeeded(false)).toBe(true);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a stopped session with pending work needs it within 15 minutes of the stop", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([fauxAssistantMessage("done")]);

      const idle = yield* startSession("work");

      yield* reaching("idle", idle.records);
      expect(yield* later("5 minutes")(idle.handle.workspaceNeeded(true))).toBe(true);

      world.faux.setResponses([
        fauxAssistantMessage("", { stopReason: "error", errorMessage: "invalid" }),
      ]);

      const failed = yield* startSession("work");

      yield* reaching("failed", failed.records);
      expect(yield* later("5 minutes")(failed.handle.workspaceNeeded(true))).toBe(true);

      yield* failed.handle.close();
      yield* reaching("closed", failed.records);
      expect(yield* later("5 minutes")(failed.handle.workspaceNeeded(true))).toBe(true);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a stopped session with pending work lets it stop past 15 minutes", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([fauxAssistantMessage("done")]);

      const { handle, records } = yield* startSession("work");

      yield* reaching("idle", records);
      expect(yield* later("16 minutes")(handle.workspaceNeeded(true))).toBe(false);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a session without a repository needs it only while running or waiting", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const held = heldAnswer("done");

      world.faux.setResponses([held.response]);

      const running = yield* startSession("work", "none");

      expect(yield* running.handle.workspaceNeeded(true)).toBe(true);
      held.release();
      yield* reaching("idle", running.records);
      expect(yield* later("1 minute")(running.handle.workspaceNeeded(true))).toBe(false);

      world.faux.setResponses([ask]);

      const waiting = yield* startSession("work", "none");

      yield* reaching("waiting", waiting.records);
      expect(yield* waiting.handle.workspaceNeeded(true)).toBe(true);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a stopped session without pending work lets it stop", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([fauxAssistantMessage("done")]);

      const { handle, records } = yield* startSession("work");

      yield* reaching("idle", records);
      expect(yield* later("1 minute")(handle.workspaceNeeded(false))).toBe(false);
    }).pipe(Effect.provide(testWorld)),
  );
});
