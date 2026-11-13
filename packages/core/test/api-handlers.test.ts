import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "@effect/vitest";
import { Entry } from "@tentacles/worker-api/entries";
import { SessionNotFound } from "@tentacles/worker-api/errors";
import { SessionId } from "@tentacles/worker-api/ids";
import { SessionState } from "@tentacles/worker-api/session-state";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { post, serveApi } from "./support/api.ts";
import { eventually } from "./support/eventually.ts";
import { createRequest, details, parent } from "./support/fixtures.ts";
import { heldAnswer, routedModel } from "./support/model.ts";
import { newSessionId, TestWorld, testWorld } from "./support/world.ts";

const decodeCreated = Schema.decodeUnknownSync(Schema.Struct({ sessionId: SessionId }));

const decodeState = Schema.decodeUnknownSync(SessionState);

const decodeEntries = Schema.decodeUnknownSync(Schema.Array(Entry));

const decodeNotFound = Schema.decodeUnknownSync(SessionNotFound);

const json = (response: Response) => Effect.promise(() => response.json());

const createOver = (api: Effect.Success<typeof serveApi>, prompt: string) =>
  Effect.gen(function* () {
    const response = yield* api("/sessions", post(JSON.stringify(createRequest(prompt))));

    expect(response.status).toBe(200);

    return decodeCreated(yield* json(response)).sessionId;
  });

const finishedSession = (api: Effect.Success<typeof serveApi>, answer: string) =>
  Effect.gen(function* () {
    const world = yield* TestWorld;

    world.faux.setResponses([fauxAssistantMessage(answer)]);

    const sessionId = yield* createOver(api, "go");

    yield* eventually(Effect.sync(() => expect(world.records(sessionId).states).toHaveLength(2)));

    return sessionId;
  });

describe("the sessions API", () => {
  it.live("create answers a new session id once the session reports running", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const api = yield* serveApi;
      const held = heldAnswer("done");

      world.faux.setResponses([held.response]);

      const sessionId = yield* createOver(api, "build it");
      const listed = yield* json(yield* api(`/sessions?harness=pi&sessionId=${parent.sessionId}`));

      expect(listed).toEqual([{ sessionId, name: "worker", status: "running", ...details }]);
      expect(world.records(sessionId).states).toEqual([SessionState.cases.running.make(details)]);
      held.release();
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("create without settings fails the schema and creates nothing", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const api = yield* serveApi;

      const response = yield* api(
        "/sessions",
        post(JSON.stringify({ name: "worker", parent, prompt: "go" })),
      );

      expect(response.status).toBe(400);
      expect(world.registryCalls).toEqual([]);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("every call on an unknown session answers SessionNotFound", () =>
    Effect.gen(function* () {
      const api = yield* serveApi;
      const sessionId = newSessionId();

      const calls = [
        api(
          `/sessions/${sessionId}/prompt`,
          post(JSON.stringify({ text: "hi", mode: "followUp" })),
        ),
        api(
          `/sessions/${sessionId}/answer`,
          post(JSON.stringify({ questionId: "1", text: "yes" })),
        ),
        api(`/sessions/${sessionId}/close`, { method: "POST" }),
        api(`/sessions/${sessionId}/messages`),
        api(`/sessions/${sessionId}/status`),
        api(`/sessions/${sessionId}/socket`, { headers: { upgrade: "websocket" } }),
      ];

      for (const call of calls) {
        const response = yield* call;

        expect(response.status).toBe(404);
        expect(decodeNotFound(yield* json(response))).toEqual(new SessionNotFound({ sessionId }));
      }
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("messages without a count returns the last entry whole", () =>
    Effect.gen(function* () {
      const api = yield* serveApi;
      const long = "x".repeat(200_000);
      const sessionId = yield* finishedSession(api, long);

      expect(decodeEntries(yield* json(yield* api(`/sessions/${sessionId}/messages`)))).toEqual([
        Entry.cases.text.make({ text: long }),
      ]);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("messages with a count returns the last entries in order, without a subagent's own", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const api = yield* serveApi;
      let rootTurns = 0;

      world.faux.setResponses(
        routedModel((request) => {
          if (!request.tools.has("subagent")) {
            return fauxAssistantMessage("4");
          }

          rootTurns += 1;

          switch (rootTurns) {
            case 1:
              return fauxAssistantMessage(
                fauxToolCall("bash", { command: "echo checked" }, { id: "bash-1" }),
                {
                  stopReason: "toolUse",
                },
              );
            case 2:
              return fauxAssistantMessage(
                fauxToolCall(
                  "subagent",
                  { action: "run", task: "add 2 and 2" },
                  { id: "subagent-1" },
                ),
                { stopReason: "toolUse" },
              );
            default:
              return fauxAssistantMessage("done");
          }
        }),
      );

      const sessionId = yield* createOver(api, "go");

      yield* eventually(Effect.sync(() => expect(world.records(sessionId).states).toHaveLength(2)));

      const all = decodeEntries(yield* json(yield* api(`/sessions/${sessionId}/messages?count=6`)));

      expect(all).toEqual([
        Entry.cases.prompt.make({ text: "go" }),
        Entry.cases.toolCall.make({
          toolCallId: "bash-1",
          name: "bash",
          arguments: { command: "echo checked" },
        }),
        Entry.cases.toolResult.make({ toolCallId: "bash-1", output: "checked\n", isError: false }),
        Entry.cases.toolCall.make({
          toolCallId: "subagent-1",
          name: "subagent",
          arguments: { action: "run", task: "add 2 and 2" },
        }),
        Entry.cases.subagentResult.make({ text: "4" }),
        Entry.cases.text.make({ text: "done" }),
      ]);
      expect(
        decodeEntries(yield* json(yield* api(`/sessions/${sessionId}/messages?count=3`))),
      ).toEqual(all.slice(3));
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a count of zero fails the schema", () =>
    Effect.gen(function* () {
      const api = yield* serveApi;
      const sessionId = yield* finishedSession(api, "done");

      expect((yield* api(`/sessions/${sessionId}/messages?count=0`)).status).toBe(400);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("status returns the derived state, an idle one without the last entry", () =>
    Effect.gen(function* () {
      const api = yield* serveApi;
      const sessionId = yield* finishedSession(api, "done");

      expect(decodeState(yield* json(yield* api(`/sessions/${sessionId}/status`)))).toEqual(
        SessionState.cases.idle.make(details),
      );
    }).pipe(Effect.provide(testWorld)),
  );

  it.live(
    "list returns the parent's sessions, closed ones included, and none for another parent",
    () =>
      Effect.gen(function* () {
        const api = yield* serveApi;
        const first = yield* finishedSession(api, "one");
        const second = yield* finishedSession(api, "two");

        yield* api(`/sessions/${second}/close`, { method: "POST" });

        const listed = yield* json(
          yield* api(`/sessions?harness=pi&sessionId=${parent.sessionId}`),
        );

        expect(listed).toHaveLength(2);
        expect(listed).toEqual(
          expect.arrayContaining([
            { sessionId: first, name: "worker", status: "idle", ...details },
            { sessionId: second, name: "worker", status: "closed", ...details },
          ]),
        );
        expect(yield* json(yield* api("/sessions?harness=claude&sessionId=nobody"))).toEqual([]);
      }).pipe(Effect.provide(testWorld)),
  );

  it.live("the socket answers 101 with the session's current state first", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const api = yield* serveApi;
      const held = heldAnswer("done");

      world.faux.setResponses([held.response]);

      const sessionId = yield* createOver(api, "go");

      const response = yield* api(`/sessions/${sessionId}/socket`, {
        headers: { upgrade: "websocket" },
      });

      expect(response.status).toBe(101);
      expect(decodeState(yield* json(response))).toEqual(SessionState.cases.running.make(details));
      held.release();
    }).pipe(Effect.provide(testWorld)),
  );
});
