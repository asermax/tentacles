import { fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";
import { DEFAULT_RESTART_LIMIT } from "@earendil-works/pi-durable";
import { describe, expect, it } from "@effect/vitest";
import { Entry } from "@tentacles/worker-api/entries";
import { QuestionNotWaiting } from "@tentacles/worker-api/errors";
import type { SessionId } from "@tentacles/worker-api/ids";
import { SessionState } from "@tentacles/worker-api/session-state";
import * as Effect from "effect/Effect";

import { post, serveApi } from "./support/api";
import { script, scriptOutput } from "./support/codemode";
import { eventually } from "./support/eventually";
import { definitionArchives, definitionNames } from "./support/archives";
import { createRequest, detailsOf } from "./support/fixtures";
import { toolResults, toolUse } from "./support/tool-calls";
import { newSessionId, TestWorld, testWorld } from "./support/world";

const ask = (question: string) => toolUse("ask_parent", { question });

const startSession = (sessionId = newSessionId()) =>
  Effect.gen(function* () {
    const world = yield* TestWorld;
    const handle = yield* world.handle(sessionId);

    const request = createRequest("work", null, yield* definitionArchives());

    yield* handle.create(request);

    return {
      sessionId,
      handle,
      records: world.records(sessionId),
      details: detailsOf(request, definitionNames),
    };
  });

/** The question the session waits on, once it does. */
const waitingOn = (sessionId: SessionId) =>
  Effect.gen(function* () {
    const world = yield* TestWorld;

    return yield* eventually(
      Effect.gen(function* () {
        const state = yield* (yield* world.handle(sessionId)).status();

        if (!SessionState.guards.waiting(state)) {
          return yield* Effect.die(new Error("not waiting yet"));
        }

        return state.question;
      }),
    );
  });

const finished = (sessionId: SessionId) =>
  Effect.gen(function* () {
    const world = yield* TestWorld;

    yield* eventually(
      Effect.sync(() =>
        expect(world.records(sessionId).states.filter(SessionState.guards.idle)).toHaveLength(1),
      ),
    );
  });

describe("the question tool", () => {
  it.live("asks, waits for the answer and goes on", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const api = yield* serveApi;

      world.faux.setResponses([ask("Which database?"), fauxAssistantMessage("Using postgres.")]);

      const { sessionId, records, details } = yield* startSession();
      const question = yield* waitingOn(sessionId);

      expect(question).toEqual({ id: question.id, text: "Which database?" });
      expect(records.states).toEqual([
        SessionState.cases.running.make(details),
        SessionState.cases.waiting.make({ ...details, question }),
      ]);

      const answered = yield* api(
        `/sessions/${sessionId}/answer`,
        post(JSON.stringify({ questionId: question.id, text: "postgres" })),
      );

      expect(answered.status).toBe(204);
      yield* finished(sessionId);
      expect(records.states.slice(2)).toEqual([
        SessionState.cases.running.make(details),
        SessionState.cases.idle.make({
          ...details,
          lastEntry: Entry.cases.text.make({ text: "Using postgres." }),
        }),
      ]);
      expect((yield* toolResults(sessionId))[0]).toMatchObject({
        output: "postgres",
        isError: false,
      });
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a script cannot call ask_parent, so it never leaves the session waiting", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([
        script("return await tools.ask_parent({ question: 'Which?' });"),
        fauxAssistantMessage("Done."),
      ]);

      const { sessionId, records } = yield* startSession();

      yield* finished(sessionId);

      expect(scriptOutput((yield* toolResults(sessionId))[0]?.output)).toContain(
        "tools.ask_parent does not exist",
      );
      expect(records.states.some(SessionState.guards.waiting)).toBe(false);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a question evicted while waiting waits again under the same id", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([ask("Still there?"), fauxAssistantMessage("Thanks.")]);

      const { sessionId, records, details } = yield* startSession();
      const question = yield* waitingOn(sessionId);

      yield* world.evict(sessionId);

      const revived = yield* world.handle(sessionId);

      yield* revived.wake();

      expect(yield* waitingOn(sessionId)).toEqual(question);

      yield* revived.answer({ questionId: question.id, text: "yes" });
      yield* finished(sessionId);
      expect((yield* toolResults(sessionId))[0]?.output).toBe("yes");
      expect(records.states.slice(0, 3)).toEqual([
        SessionState.cases.running.make(details),
        SessionState.cases.waiting.make({ ...details, question }),
        SessionState.cases.running.make(details),
      ]);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a question waits through more evictions than pi-durable's restart limit", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([ask("Still there?"), fauxAssistantMessage("Thanks.")]);

      const { sessionId } = yield* startSession();
      const question = yield* waitingOn(sessionId);

      for (let eviction = 0; eviction <= DEFAULT_RESTART_LIMIT; eviction++) {
        yield* world.crash(sessionId);
        yield* (yield* world.handle(sessionId)).wake();
        yield* world.pickedUp(sessionId);
      }

      expect(yield* waitingOn(sessionId)).toEqual(question);

      yield* (yield* world.handle(sessionId)).answer({ questionId: question.id, text: "yes" });
      yield* finished(sessionId);
      expect((yield* toolResults(sessionId))[0]).toMatchObject({ output: "yes", isError: false });
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a second answer to the same question is refused", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const api = yield* serveApi;

      world.faux.setResponses([ask("Go?"), fauxAssistantMessage("Went.")]);

      const { sessionId } = yield* startSession();
      const question = yield* waitingOn(sessionId);
      const answer = post(JSON.stringify({ questionId: question.id, text: "go" }));

      expect((yield* api(`/sessions/${sessionId}/answer`, answer)).status).toBe(204);
      expect((yield* api(`/sessions/${sessionId}/answer`, answer)).status).toBe(409);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("an answer to another question id is refused and the question still waits", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const api = yield* serveApi;

      world.faux.setResponses([ask("Go?"), fauxAssistantMessage("Went.")]);

      const { sessionId, handle, details } = yield* startSession();
      const question = yield* waitingOn(sessionId);

      const wrong = yield* api(
        `/sessions/${sessionId}/answer`,
        post(JSON.stringify({ questionId: "999999", text: "go" })),
      );

      expect(wrong.status).toBe(409);
      expect(yield* handle.status()).toEqual(
        SessionState.cases.waiting.make({ ...details, question }),
      );
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("with no socket open, status carries the waiting question", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([ask("Anyone?"), fauxAssistantMessage("Ok.")]);

      const { sessionId, handle, details } = yield* startSession();
      const question = yield* waitingOn(sessionId);

      expect(yield* handle.status()).toEqual(
        SessionState.cases.waiting.make({
          ...details,
          question: { id: question.id, text: "Anyone?" },
        }),
      );
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a prompt while a question waits is held as a steer until the answer", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([ask("Which?"), fauxAssistantMessage("Did both.")]);

      const { sessionId, handle, details } = yield* startSession();
      const question = yield* waitingOn(sessionId);

      yield* handle.prompt({ text: "also update the docs", mode: "followUp" });
      yield* Effect.sleep("50 millis");

      expect(world.faux.state.callCount).toBe(1);
      expect(yield* handle.status()).toEqual(
        SessionState.cases.waiting.make({ ...details, question }),
      );

      yield* handle.answer({ questionId: question.id, text: "the first" });
      yield* finished(sessionId);

      const entries = yield* handle.messages(30);

      const answerAt = entries.findIndex(
        (entry) => Entry.guards.toolResult(entry) && entry.output === "the first",
      );

      const steerAt = entries.findIndex(
        (entry) => Entry.guards.prompt(entry) && entry.text === "also update the docs",
      );

      expect(answerAt).toBeGreaterThan(-1);
      expect(steerAt).toBeGreaterThan(answerAt);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("closing a waiting session ends the question, so an answer is refused", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.faux.setResponses([ask("Wait?")]);

      const { sessionId, handle, records, details } = yield* startSession();

      const question = yield* waitingOn(sessionId);

      yield* handle.close();

      yield* eventually(
        Effect.sync(() =>
          expect(records.states.at(-1)).toEqual(SessionState.cases.closed.make(details)),
        ),
      );
      expect(
        yield* handle.answer({ questionId: question.id, text: "late" }).pipe(Effect.flip),
      ).toEqual(new QuestionNotWaiting({ questionId: question.id }));
    }).pipe(Effect.provide(testWorld)),
  );
});
