import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "@effect/vitest";
import { Entry } from "@tentacles/worker-api/entries";
import { SessionState } from "@tentacles/worker-api/session-state";
import type { Repository } from "@tentacles/worker-api/settings";
import * as Effect from "effect/Effect";

import { eventually } from "./support/eventually.ts";
import { createRequest } from "./support/fixtures.ts";
import { bareRepository } from "./support/workspace.ts";
import { newSessionId, TestWorld, testWorld } from "./support/world.ts";

const bash = (command: string) =>
  fauxAssistantMessage(fauxToolCall("bash", { command }), { stopReason: "toolUse" });

const write = (path: string, content: string) =>
  fauxAssistantMessage(fauxToolCall("write", { path, content }), { stopReason: "toolUse" });

/** Runs a session to its end and returns the results of its tool calls. */
const runSession = (repository: Repository | null) =>
  Effect.gen(function* () {
    const world = yield* TestWorld;
    const sessionId = newSessionId();
    const handle = yield* world.handle(sessionId);

    yield* handle.create(createRequest("work", repository));
    yield* eventually(Effect.sync(() => expect(world.records(sessionId).states).toHaveLength(2)));

    const results = (yield* handle.messages(20)).filter(Entry.guards.toolResult);

    const records = world.records(sessionId);

    return {
      results,
      ensures: records.workspace.ensures.map((ensured) => ensured.repository),
      settings: records.workspace.ensures,
      states: records.states,
    };
  });

describe("the workspace before each tool call", () => {
  it.live("the first tool call finds the repository cloned in /workspace", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const repository = { url: bareRepository(world.shared, "app"), shallow: true };

      world.faux.setResponses([bash("cat /workspace/README.md"), fauxAssistantMessage("read it")]);

      const { results, settings } = yield* runSession(repository);

      expect(settings[0]).toEqual({ repository, image: "default", size: "basic", lifetime: 15 });
      expect(results).toHaveLength(1);
      expect(results[0]?.isError).toBe(false);
      expect(results[0]?.output).toContain("# app");
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("every tool call ensures the workspace first", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const repository = { url: bareRepository(world.shared, "app"), shallow: false };

      world.faux.setResponses([bash("true"), bash("true"), fauxAssistantMessage("done")]);

      const { results, ensures } = yield* runSession(repository);

      expect(results).toHaveLength(2);
      // One ensure per tool call, and one for the end-of-run commit check.
      expect(ensures).toEqual([repository, repository, repository]);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a model turn with no tool call does not start the workspace", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([fauxAssistantMessage("nothing to run")]);

      // Without a repository no commit check runs, so only a section render
      // could reach the workspace.
      const { results, ensures } = yield* runSession(null);

      expect(results).toEqual([]);
      expect(ensures).toEqual([]);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("without a repository the workspace starts empty", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([bash("ls -A /workspace | wc -l"), fauxAssistantMessage("empty")]);

      const { results, ensures } = yield* runSession(null);

      expect(ensures.every((each) => each == null)).toBe(true);
      expect(results[0]?.output.trim()).toBe("0");
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a failed ensure fails only that tool call, and the next call ensures again", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const repository = { url: `${world.shared}/missing.git`, shallow: true };

      world.faux.setResponses([bash("true"), bash("true"), fauxAssistantMessage("gave up")]);

      const { results, ensures, states } = yield* runSession(repository);

      expect(results).toHaveLength(2);
      expect(results.every((result) => result.isError)).toBe(true);
      expect(results[0]?.output).toContain("git clone failed");
      expect(ensures.length).toBeGreaterThanOrEqual(2);
      expect(states.at(-1)).toEqual(
        SessionState.cases.idle.make({ lastEntry: Entry.cases.text.make({ text: "gave up" }) }),
      );
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("the write tool creates a file that does not exist yet", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([
        write("notes.md", "fresh"),
        bash("cat /workspace/notes.md"),
        fauxAssistantMessage("wrote it"),
      ]);

      const { results } = yield* runSession(null);

      expect(results.map((result) => result.isError)).toEqual([false, false]);
      expect(results[1]?.output).toContain("fresh");
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("the write tool creates a file in a directory that does not exist yet", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([
        write("docs/new/notes.md", "nested"),
        bash("cat /workspace/docs/new/notes.md"),
        fauxAssistantMessage("wrote it"),
      ]);

      const { results } = yield* runSession(null);

      expect(results.map((result) => result.isError)).toEqual([false, false]);
      expect(results[1]?.output).toContain("nested");
    }).pipe(Effect.provide(testWorld)),
  );
});
