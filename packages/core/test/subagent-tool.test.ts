import type { AssistantMessage } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "@effect/vitest";
import { Entry } from "@tentacles/worker-api/entries";
import type { SessionId } from "@tentacles/worker-api/ids";
import * as Effect from "effect/Effect";

import { eventually } from "./support/eventually.ts";
import { createRequest } from "./support/fixtures.ts";
import { heldAnswer, type ModelRequest, routedModel } from "./support/model.ts";
import { newSessionId, TestWorld, testWorld } from "./support/world.ts";

type SubagentCall =
  | { action: "run"; task: string }
  | { action: "spawn"; task: string; name: string }
  | { action: "message"; id: string; text: string; mode: "followUp" | "steer" }
  | { action: "wait"; id: string }
  | { action: "stop"; id: string }
  | { action: "list" };

const call = (args: SubagentCall) =>
  fauxAssistantMessage(fauxToolCall("subagent", args), { stopReason: "toolUse" });

const say = (text: string) => fauxAssistantMessage(text);

const isRoot = (request: ModelRequest) => request.tools.has("subagent");

const startedId = (text: string) => /with id (\S+)\./.exec(text)?.[1] ?? "unknown";

/** Starts a session on a model that answers by what each request shows. */
const startSession = (
  answer: (request: ModelRequest) => AssistantMessage | Promise<AssistantMessage>,
) =>
  Effect.gen(function* () {
    const world = yield* TestWorld;
    const sessionId = newSessionId();
    const handle = yield* world.handle(sessionId);

    world.faux.setResponses(routedModel(answer));
    yield* handle.create(createRequest("go"));

    return { sessionId, handle };
  });

const entriesOf = (sessionId: SessionId) =>
  Effect.flatMap(TestWorld, (world) =>
    Effect.flatMap(world.handle(sessionId), (handle) => handle.messages(100)),
  );

const toolResultsOf = (sessionId: SessionId) =>
  Effect.map(entriesOf(sessionId), (entries) => entries.filter(Entry.guards.toolResult));

const settled = (sessionId: SessionId, text: string) =>
  eventually(
    Effect.gen(function* () {
      expect(yield* entriesOf(sessionId)).toContainEqual(Entry.cases.text.make({ text }));
    }),
  );

describe("the subagent tool", () => {
  it.live(
    "run waits for a foreground child and shows its answer once in the root conversation",
    () =>
      Effect.gen(function* () {
        const { sessionId } = yield* startSession((request) => {
          if (!isRoot(request)) {
            return say("4");
          }

          return request.lastRole === "toolResult"
            ? say("The child says 4")
            : call({ action: "run", task: "add 2 and 2" });
        });

        yield* settled(sessionId, "The child says 4");

        const entries = yield* entriesOf(sessionId);

        expect(entries.filter(Entry.guards.subagentResult)).toEqual([
          Entry.cases.subagentResult.make({ text: "4" }),
        ]);
        expect(entries).not.toContainEqual(Entry.cases.text.make({ text: "4" }));
      }).pipe(Effect.provide(testWorld)),
  );

  it.live("spawn returns an id at once and the child's answer arrives later as an input", () =>
    Effect.gen(function* () {
      const { sessionId } = yield* startSession((request) => {
        if (!isRoot(request)) {
          return say("a summary");
        }

        if (request.last.startsWith("[subagent")) {
          return say("Noted.");
        }

        return request.lastRole === "toolResult"
          ? say("Spawned.")
          : call({ action: "spawn", task: "summarize the book", name: "reader" });
      });

      yield* settled(sessionId, "Noted.");

      const entries = yield* entriesOf(sessionId);

      expect((yield* toolResultsOf(sessionId))[0]?.output).toMatch(
        /^Started subagent reader with id \S+\.$/,
      );
      expect(entries).toContainEqual(
        Entry.cases.subagentResult.make({ text: "[subagent reader answered] a summary" }),
      );
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("follow-ups and steers sent to a running child reach it", () =>
    Effect.gen(function* () {
      const childSaw: string[] = [];
      let sent = 0;

      const { sessionId } = yield* startSession((request) => {
        if (!isRoot(request)) {
          childSaw.push(request.last);

          return say(`handled: ${request.last}`);
        }

        if (request.last.startsWith("[subagent")) {
          return say("Noted.");
        }

        if (request.lastRole !== "toolResult") {
          return call({ action: "spawn", task: "summarize the book", name: "reader" });
        }

        if (request.last.startsWith("Started")) {
          const id = startedId(request.last);

          sent += 1;

          return call({ action: "message", id, text: "also check chapter 2", mode: "followUp" });
        }

        if (sent === 1) {
          sent += 1;

          return call({ action: "list" });
        }

        return say("Sent.");
      });

      yield* settled(sessionId, "Sent.");
      yield* eventually(
        Effect.sync(() => expect(childSaw).toEqual(["summarize the book", "also check chapter 2"])),
      );
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a steer reaches a child that is still answering", () =>
    Effect.gen(function* () {
      const childSaw: string[] = [];
      const held = heldAnswer("first answer");
      let childRequests = 0;

      const { sessionId } = yield* startSession((request) => {
        if (!isRoot(request)) {
          childSaw.push(request.last);
          childRequests += 1;

          return childRequests === 1 ? held.answer(request.signal) : say("steered answer");
        }

        if (request.last.startsWith("[subagent")) {
          return say("Noted.");
        }

        if (request.lastRole !== "toolResult") {
          return call({ action: "spawn", task: "summarize the book", name: "reader" });
        }

        if (request.last.startsWith("Started")) {
          return call({
            action: "message",
            id: startedId(request.last),
            text: "focus on whales",
            mode: "steer",
          });
        }

        held.release();

        return say("Steered.");
      });

      yield* settled(sessionId, "Steered.");
      yield* eventually(Effect.sync(() => expect(childSaw).toContain("focus on whales")));
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("wait returns a child's answer to its last message", () =>
    Effect.gen(function* () {
      const { sessionId } = yield* startSession((request) => {
        if (!isRoot(request)) {
          return say("a summary");
        }

        if (request.last.startsWith("[subagent")) {
          return say("Noted.");
        }

        if (request.lastRole !== "toolResult") {
          return call({ action: "spawn", task: "summarize the book", name: "reader" });
        }

        return request.last.startsWith("Started")
          ? call({ action: "wait", id: startedId(request.last) })
          : say("Waited.");
      });

      yield* settled(sessionId, "Waited.");
      expect((yield* toolResultsOf(sessionId))[1]?.output).toBe("a summary");
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("stop ends a child's work and list shows it stopped", () =>
    Effect.gen(function* () {
      const childStarted = Promise.withResolvers<void>();
      const held = heldAnswer("never finished");
      let id = "";

      const { sessionId } = yield* startSession(async (request) => {
        if (!isRoot(request)) {
          childStarted.resolve();

          return held.answer(request.signal);
        }

        if (request.lastRole !== "toolResult") {
          return call({ action: "spawn", task: "read everything", name: "reader" });
        }

        if (request.last.startsWith("Started")) {
          id = startedId(request.last);
          await childStarted.promise;

          return call({ action: "stop", id });
        }

        return request.last.startsWith("Stopped") ? call({ action: "list" }) : say("Listed.");
      });

      yield* settled(sessionId, "Listed.");
      expect((yield* toolResultsOf(sessionId)).at(-1)?.output).toBe(`${id} reader stopped`);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("list shows each child's id, name and status", () =>
    Effect.gen(function* () {
      const ids: string[] = [];

      const { sessionId } = yield* startSession((request) => {
        if (!isRoot(request)) {
          return say("ok");
        }

        if (request.last.startsWith("[subagent")) {
          return say("Noted.");
        }

        if (request.lastRole !== "toolResult") {
          return call({ action: "spawn", task: "first task", name: "first" });
        }

        if (request.last.startsWith("Started")) {
          ids.push(startedId(request.last));

          return ids.length === 1
            ? call({ action: "spawn", task: "second task", name: "second" })
            : call({ action: "list" });
        }

        return say("Listed.");
      });

      yield* settled(sessionId, "Listed.");

      const listing = (yield* toolResultsOf(sessionId))[2]?.output.split("\n") ?? [];

      expect(listing).toHaveLength(2);
      expect(listing[0]).toMatch(new RegExp(`^${ids[0]} first (running|idle)$`));
      expect(listing[1]).toMatch(new RegExp(`^${ids[1]} second (running|idle)$`));
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a child has neither the question tool nor the subagent tool", () =>
    Effect.gen(function* () {
      const childTools: string[] = [];

      const { sessionId } = yield* startSession((request) => {
        if (!isRoot(request)) {
          childTools.push(...request.tools);

          return say("done");
        }

        return request.lastRole === "toolResult"
          ? say("Finished.")
          : call({ action: "run", task: "look" });
      });

      yield* settled(sessionId, "Finished.");
      expect(childTools).toContain("bash");
      expect(childTools).toContain("preview");
      expect(childTools).not.toContain("ask_parent");
      expect(childTools).not.toContain("subagent");
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("message, wait and stop on an unknown child id fail naming the id", () =>
    Effect.gen(function* () {
      let calls = 0;

      const unknownCalls: SubagentCall[] = [
        { action: "message", id: "999", text: "hi", mode: "followUp" },
        { action: "wait", id: "999" },
        { action: "stop", id: "999" },
      ];

      const { sessionId } = yield* startSession(() => {
        const next = unknownCalls[calls];

        calls += 1;

        return next == null ? say("Gave up.") : call(next);
      });

      yield* settled(sessionId, "Gave up.");

      const results = yield* toolResultsOf(sessionId);

      expect(results).toHaveLength(3);

      for (const result of results) {
        expect(result.isError).toBe(true);
        expect(result.output).toContain("No subagent with id 999");
      }
    }).pipe(Effect.provide(testWorld)),
  );
});
