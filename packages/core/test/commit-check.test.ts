import {
  type FauxResponseStep,
  fauxAssistantMessage,
  fauxToolCall,
} from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "@effect/vitest";
import { Entry } from "@tentacles/worker-api/entries";
import type { SessionId } from "@tentacles/worker-api/ids";
import { SessionState } from "@tentacles/worker-api/session-state";
import type { Repository } from "@tentacles/worker-api/settings";
import * as Effect from "effect/Effect";

import { eventually } from "./support/eventually.ts";
import { createRequest } from "./support/fixtures.ts";
import { heldAnswer } from "./support/model.ts";
import { bareRepository } from "./support/workspace.ts";
import { newSessionId, TestWorld, testWorld } from "./support/world.ts";

const bash = (command: string) =>
  fauxAssistantMessage(fauxToolCall("bash", { command }), { stopReason: "toolUse" });

const leaveChange = bash("echo change >> README.md");

const commitAndPush = bash("git commit -qam 'save work' && git push -q origin main");

const answer = (text: string) => fauxAssistantMessage(text);

const running = SessionState.cases.running.make({});

const startSession = (responses: FauxResponseStep[], repository: "managed" | "none" = "managed") =>
  Effect.gen(function* () {
    const world = yield* TestWorld;
    const sessionId = newSessionId();
    const handle = yield* world.handle(sessionId);

    const managed: Repository | null =
      repository === "managed"
        ? { url: bareRepository(world.shared, "app"), shallow: false }
        : null;

    world.faux.setResponses(responses);
    yield* handle.create(createRequest("work", managed));

    return { sessionId, handle, records: world.records(sessionId) };
  });

const commitPrompts = (sessionId: SessionId) =>
  Effect.gen(function* () {
    const world = yield* TestWorld;
    const entries = yield* (yield* world.handle(sessionId)).messages(100);

    return entries
      .filter(Entry.guards.prompt)
      .filter((entry) => entry.text.startsWith("Your run finished with work"));
  });

const stoppedWith = (sessionId: SessionId, state: SessionState) =>
  Effect.gen(function* () {
    const world = yield* TestWorld;

    yield* eventually(
      Effect.sync(() => expect(world.records(sessionId).states.at(-1)).toEqual(state)),
    );
  });

const idleAfter = (text: string) =>
  SessionState.cases.idle.make({ lastEntry: Entry.cases.text.make({ text }) });

describe("the end-of-run commit check", () => {
  it.live(
    "pending work at the end prompts the agent to commit in a new run, with no idle between",
    () =>
      Effect.gen(function* () {
        const held = heldAnswer("committing");

        const { sessionId, records } = yield* startSession([
          leaveChange,
          answer("done"),
          held.response,
        ]);

        yield* eventually(
          Effect.gen(function* () {
            expect(yield* commitPrompts(sessionId)).toHaveLength(1);
          }),
        );

        const [prompt] = yield* commitPrompts(sessionId);

        expect(prompt?.text).toContain(" M README.md");
        expect(records.states).toEqual([running]);
        held.release();
      }).pipe(Effect.provide(testWorld)),
  );

  it.live("an agent that commits and pushes after the prompt finishes idle", () =>
    Effect.gen(function* () {
      const { sessionId, records } = yield* startSession([
        leaveChange,
        answer("done"),
        commitAndPush,
        answer("pushed"),
      ]);

      yield* stoppedWith(sessionId, idleAfter("pushed"));
      expect(records.states).toEqual([running, idleAfter("pushed")]);
      expect(yield* commitPrompts(sessionId)).toHaveLength(1);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("after three prompts the run finishes with the work still pending", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      const { sessionId } = yield* startSession([
        leaveChange,
        answer("done"),
        answer("no"),
        answer("still no"),
        answer("never"),
      ]);

      yield* stoppedWith(sessionId, idleAfter("never"));
      expect(yield* commitPrompts(sessionId)).toHaveLength(3);
      expect(world.faux.state.callCount).toBe(5);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a run that never used the workspace finishes idle without starting it", () =>
    Effect.gen(function* () {
      const { sessionId, records } = yield* startSession([answer("ok")]);

      yield* stoppedWith(sessionId, idleAfter("ok"));
      expect(records.workspace.ensures).toEqual([]);
      expect(yield* commitPrompts(sessionId)).toEqual([]);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("without a repository nothing is checked", () =>
    Effect.gen(function* () {
      const { sessionId } = yield* startSession([leaveChange, answer("done")], "none");

      yield* stoppedWith(sessionId, idleAfter("done"));
      expect(yield* commitPrompts(sessionId)).toEqual([]);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a failed run is not checked", () =>
    Effect.gen(function* () {
      const { sessionId } = yield* startSession([
        leaveChange,
        fauxAssistantMessage("", { stopReason: "error", errorMessage: "invalid request" }),
      ]);

      yield* stoppedWith(
        sessionId,
        SessionState.cases.failed.make({ failure: "model_error: invalid request" }),
      );
      expect(yield* commitPrompts(sessionId)).toEqual([]);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("an aborted run is not checked", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const held = heldAnswer("never finished");
      const { sessionId, handle } = yield* startSession([leaveChange, held.response]);

      yield* eventually(Effect.sync(() => expect(world.faux.state.callCount).toBe(2)));
      yield* handle.close();

      yield* stoppedWith(sessionId, SessionState.cases.closed.make({}));
      expect(yield* commitPrompts(sessionId)).toEqual([]);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("the prompt count survives an eviction", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const held = heldAnswer("cut off");

      const { sessionId } = yield* startSession([
        leaveChange,
        answer("done"),
        answer("no"),
        held.response,
        answer("resent: no"),
        answer("never"),
      ]);

      yield* eventually(Effect.sync(() => expect(world.faux.state.callCount).toBe(4)));
      expect(yield* commitPrompts(sessionId)).toHaveLength(2);

      yield* world.evict(sessionId);
      yield* (yield* world.handle(sessionId)).wake();

      yield* stoppedWith(sessionId, idleAfter("never"));
      expect(yield* commitPrompts(sessionId)).toHaveLength(3);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a prompt from the parent starts the count over", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      const { sessionId, handle } = yield* startSession([
        leaveChange,
        answer("done"),
        answer("no"),
        answer("no"),
        answer("no"),
      ]);

      yield* stoppedWith(sessionId, idleAfter("no"));
      expect(yield* commitPrompts(sessionId)).toHaveLength(3);

      world.faux.setResponses([answer("later"), answer("no"), answer("no"), answer("final")]);
      yield* handle.prompt({ text: "anything else?", mode: "followUp" });

      yield* eventually(Effect.sync(() => expect(world.faux.state.callCount).toBe(9)));
      yield* stoppedWith(sessionId, idleAfter("final"));
      expect(yield* commitPrompts(sessionId)).toHaveLength(6);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a prompt into a run already going keeps the count", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const held = heldAnswer("no");

      const { sessionId, handle } = yield* startSession([
        leaveChange,
        answer("done"),
        held.response,
        answer("no"),
        answer("no"),
        answer("never"),
      ]);

      yield* eventually(Effect.sync(() => expect(world.faux.state.callCount).toBe(3)));
      yield* handle.prompt({ text: "keep going", mode: "followUp" });
      held.release();

      yield* stoppedWith(sessionId, idleAfter("never"));
      expect(yield* commitPrompts(sessionId)).toHaveLength(3);
    }).pipe(Effect.provide(testWorld)),
  );
});
