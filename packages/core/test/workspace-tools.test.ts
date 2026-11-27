import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "@effect/vitest";
import { Entry } from "@tentacles/worker-api/entries";
import type { SessionId } from "@tentacles/worker-api/ids";
import { SessionState } from "@tentacles/worker-api/session-state";
import * as Effect from "effect/Effect";

import { script, scriptOutput } from "./support/codemode";
import { eventually } from "./support/eventually";
import { createRequest } from "./support/fixtures";
import { heldAnswer, type ModelRequest, routedModel } from "./support/model";
import { newSessionId, TestWorld, testWorld } from "./support/world";

const toolUse = (name: string, args: Record<string, string>) =>
  fauxAssistantMessage(fauxToolCall(name, args), { stopReason: "toolUse" });

const startSession = Effect.gen(function* () {
  const world = yield* TestWorld;
  const sessionId = newSessionId();
  const handle = yield* world.handle(sessionId);

  yield* handle.create(createRequest("work"));

  return { world, sessionId, handle, records: world.records(sessionId) };
});

const idle = (sessionId: SessionId) =>
  Effect.gen(function* () {
    const world = yield* TestWorld;

    yield* eventually(
      Effect.sync(() =>
        expect(world.records(sessionId).states.filter(SessionState.guards.idle)).toHaveLength(1),
      ),
    );
  });

const toolResults = (sessionId: SessionId) =>
  Effect.gen(function* () {
    const world = yield* TestWorld;

    return (yield* (yield* world.handle(sessionId)).messages(30)).filter(Entry.guards.toolResult);
  });

describe("the workspace's tools", () => {
  it.live("the root's first request lists the workspace tools and none of the coding tools", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const requests: ModelRequest[] = [];

      world.faux.setResponses(
        routedModel((request) => {
          requests.push(request);

          return fauxAssistantMessage("seen");
        }),
      );

      const { sessionId } = yield* startSession;

      yield* idle(sessionId);

      const [first] = requests;

      expect(first?.tools).toContain("workspace_write");
      expect(first?.tools).toContain("workspace_read");

      for (const coding of ["bash", "read", "write", "edit"]) {
        expect(first?.tools).not.toContain(coding);
      }

      expect(first?.sections.get("tentacles")).toContain("/workspace/repo");
      expect(first?.sections.get("tentacles")).toContain("/workspace/skills");
      expect(first?.sections.get("tentacles")).toContain("/workspace/context");
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a run evicted midway resumes on a new instance and calls a workspace tool", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const held = heldAnswer("cut off");

      world.faux.setResponses([
        toolUse("workspace_write", { path: "notes.md", text: "kept" }),
        held.response,
        toolUse("workspace_read", { path: "notes.md" }),
        fauxAssistantMessage("read it"),
      ]);

      const { sessionId } = yield* startSession;

      yield* eventually(Effect.sync(() => expect(world.faux.state.callCount).toBe(2)));
      yield* world.evict(sessionId);
      yield* (yield* world.handle(sessionId)).wake();
      yield* idle(sessionId);

      expect(
        (yield* toolResults(sessionId)).map(({ output, isError }) => [output, isError]),
      ).toEqual([
        ["wrote notes.md", false],
        ["kept", false],
      ]);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a codemode script calls a workspace tool by name", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([
        script(
          "await tools.workspace_write({ path: 'a.txt', text: 'from a script' }); return await tools.workspace_read({ path: 'a.txt' });",
        ),
        fauxAssistantMessage("done"),
      ]);

      const { sessionId, records } = yield* startSession;

      yield* idle(sessionId);

      expect(scriptOutput((yield* toolResults(sessionId))[0]?.output)).toContain("from a script");
      expect(records.workspace.files.get("a.txt")).toBe("from a script");
    }).pipe(Effect.provide(testWorld)),
  );
});
