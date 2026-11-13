import { SessionNotFound } from "@tentacles/worker-api/errors";
import type { SessionId } from "@tentacles/worker-api/ids";
import { afterEach, describe, expect, it } from "vitest";

import { runHelperWatch, variablesFor } from "./helper-run";
import { startStubWorker, type ScriptedSession, type StubWorker } from "./stub-worker";
import {
  details as baseDetails,
  Failed,
  Idle,
  questionOf,
  Running,
  sessionIdOf,
  TextEntry,
  Waiting,
} from "./values";

const named = { ...baseDetails, skills: ["implement"], agents: ["reviewer"] };

const running = Running.make(named);

const lastEntry = TextEntry.make({ text: "Pushed the branch." });

const finished = Idle.make({ ...named, lastEntry });

let worker: StubWorker | undefined;

const startWorker = async (sessions: ReadonlyArray<readonly [SessionId, ScriptedSession]>) => {
  worker = await startStubWorker({ sessions: new Map(sessions) });

  return worker;
};

afterEach(async () => {
  await worker?.stop();
  worker = undefined;
});

describe("helper watch", () => {
  it("fetches the last message of a session already idle on connect and prints it in the idle line", async () => {
    const sessionId = sessionIdOf(1);

    const stub = await startWorker([
      [
        sessionId,
        {
          states: [{ state: Idle.make(named) }],
          entries: [TextEntry.make({ text: "older" }), lastEntry],
        },
      ],
    ]);

    const lines = await runHelperWatch(
      [sessionId],
      variablesFor(stub.url),
      (printed) => printed.length >= 1,
    );

    expect(lines).toEqual([{ sessionId, state: finished }]);
    expect(stub.requests.filter((request) => request.endpoint === "messages")).toEqual([
      { endpoint: "messages", sessionId, query: { count: 1 } },
    ]);
  });

  it("prints running, then the idle a finishing run sends with its last entry, without calling messages", async () => {
    const sessionId = sessionIdOf(1);

    const stub = await startWorker([
      [sessionId, { states: [{ state: running }, { state: finished, afterMs: 50 }], entries: [] }],
    ]);

    const lines = await runHelperWatch(
      [sessionId],
      variablesFor(stub.url),
      (printed) => printed.length >= 2,
    );

    expect(lines).toEqual([
      { sessionId, state: running },
      { sessionId, state: finished },
    ]);
    expect(stub.requests.some((request) => request.endpoint === "messages")).toBe(false);
  });

  it("prints waiting with the question", async () => {
    const sessionId = sessionIdOf(1);
    const waiting = Waiting.make({ ...named, question: questionOf("q-1", "Which branch?") });
    const stub = await startWorker([[sessionId, { states: [{ state: waiting }], entries: [] }]]);

    const lines = await runHelperWatch(
      [sessionId],
      variablesFor(stub.url),
      (printed) => printed.length >= 1,
    );

    expect(lines).toEqual([{ sessionId, state: waiting }]);
  });

  it("prints failed with the failure", async () => {
    const sessionId = sessionIdOf(1);
    const failed = Failed.make({ ...named, failure: "The model refused the key." });
    const stub = await startWorker([[sessionId, { states: [{ state: failed }], entries: [] }]]);

    const lines = await runHelperWatch(
      [sessionId],
      variablesFor(stub.url),
      (printed) => printed.length >= 1,
    );

    expect(lines).toEqual([{ sessionId, state: failed }]);
  });

  it("holds one socket per session and names its session on every line", async () => {
    const [first, second, third] = [sessionIdOf(1), sessionIdOf(2), sessionIdOf(3)];
    const waiting = Waiting.make({ ...named, question: questionOf("q-2", "Merge?") });

    const stub = await startWorker([
      [first, { states: [{ state: running }], entries: [] }],
      [second, { states: [{ state: waiting }], entries: [] }],
      [third, { states: [{ state: finished }], entries: [] }],
    ]);

    const lines = await runHelperWatch(
      [first, second, third],
      variablesFor(stub.url),
      (printed) => printed.length >= 3,
    );

    const sockets = stub.requests
      .filter((request) => request.endpoint === "socket")
      .map((request) => request.sessionId ?? "")
      .toSorted((left, right) => left.localeCompare(right));

    expect(sockets).toEqual([first, second, third]);
    expect(lines).toHaveLength(3);
    expect(lines).toEqual(
      expect.arrayContaining([
        { sessionId: first, state: running },
        { sessionId: second, state: waiting },
        { sessionId: third, state: finished },
      ]),
    );
  });

  it("prints a SessionNotFound line for a session that does not exist while the other sockets go on", async () => {
    const [present, deleted] = [sessionIdOf(1), sessionIdOf(2)];

    const stub = await startWorker([
      [present, { states: [{ state: running }, { state: finished, afterMs: 200 }], entries: [] }],
    ]);

    const lines = await runHelperWatch(
      [present, deleted],
      variablesFor(stub.url),
      (printed) => printed.length >= 3,
    );

    expect(lines).toEqual(
      expect.arrayContaining([
        { sessionId: deleted, error: new SessionNotFound({ sessionId: deleted }) },
        { sessionId: present, state: running },
      ]),
    );
    expect(lines.at(-1)).toEqual({ sessionId: present, state: finished });
  });
});
