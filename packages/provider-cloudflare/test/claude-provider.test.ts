import { describe, expect, it } from "@effect/vitest";
import { lostCallMessage } from "@tentacles/relay-protocol/lost-call";
import { StreamRequest } from "@tentacles/relay-protocol/stream-request";
import { SessionState } from "@tentacles/worker-api/session-state";
import { env } from "cloudflare:workers";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { claudeObject, resetClaude } from "./claude";
import type { RelayAnswer } from "./fake-container";
import { claudeSettings, parent, waitUntilRunEnds } from "./sessions";

const decodeRequest = Schema.decodeUnknownSync(Schema.fromJsonString(StreamRequest));

const FailureLine = Schema.Struct({
  message: Schema.Literal("A Claude call failed"),
  session: Schema.String,
  conversation: Schema.optional(Schema.String),
  errorMessage: Schema.String,
});

const decodeFailureLine = Schema.decodeUnknownOption(Schema.fromJsonString(FailureLine));

// pi-durable waits 2, 4 and 8 seconds before its three retries.
const firstRetryDelayMs = 2_000;
const retryDelaysMs = [firstRetryDelayMs, 4_000, 8_000];
const generousRunMs = 60_000;

const runSession = async (answers: ReadonlyArray<RelayAnswer>) => {
  await resetClaude({ answers });

  const sessionId = crypto.randomUUID();

  await env.SessionObject.getByName(sessionId).create({
    name: "worker",
    parent,
    prompt: "Say done.",
    settings: { ...claudeSettings, repository: null },
  });

  const state = await waitUntilRunEnds(sessionId, generousRunMs / 100);
  const { relayRequests } = await claudeObject().containerState();

  const failures = (await claudeObject().workerErrors()).flatMap((line) =>
    Option.toArray(decodeFailureLine(line)),
  );

  return {
    sessionId,
    state,
    failures,
    calls: relayRequests.map((request) => ({
      body: decodeRequest(request.body),
      receivedAt: request.receivedAt,
    })),
  };
};

describe("a Claude model call from a session run", () => {
  it(
    "reaches the relay with the session and the conversation, and finishes the run",
    async () => {
      const { sessionId, state, failures, calls } = await runSession(["done"]);

      expect(SessionState.guards.idle(state)).toBe(true);
      expect(failures).toEqual([]);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.body.sender.session).toBe(sessionId);
      expect(calls[0]?.body.options.sessionId).toBeDefined();
    },
    generousRunMs,
  );

  it(
    "retries a subagent's lost call after 2 seconds and logs the failure once",
    async () => {
      const { sessionId, state, failures, calls } = await runSession([
        "subagent",
        "lost",
        "done",
        "done",
      ]);

      const [rootCall, lostCall, retriedCall] = calls;

      expect(SessionState.guards.idle(state)).toBe(true);
      expect(calls).toHaveLength(4);
      expect(failures).toEqual([
        {
          message: "A Claude call failed",
          session: sessionId,
          conversation: lostCall?.body.options.sessionId,
          errorMessage: lostCallMessage("Claude Code exited from signal SIGTERM"),
        },
      ]);
      expect(lostCall?.body.options.sessionId).not.toBe(rootCall?.body.options.sessionId);
      expect(retriedCall?.body.options.sessionId).toBe(lostCall?.body.options.sessionId);
      expect((retriedCall?.receivedAt ?? 0) - (lostCall?.receivedAt ?? 0)).toBeGreaterThanOrEqual(
        firstRetryDelayMs - 100,
      );
    },
    generousRunMs,
  );

  it(
    "ends the run as failed after the third retry of a call that is lost every time, with four log lines",
    async () => {
      const { state, failures, calls } = await runSession(["lost"]);

      expect(SessionState.guards.failed(state) && state.failure).toContain("model_error");
      expect(calls).toHaveLength(retryDelaysMs.length + 1);
      expect(failures).toHaveLength(retryDelaysMs.length + 1);
    },
    generousRunMs,
  );

  it(
    "does not retry a call the model refused, and logs it once",
    async () => {
      const { state, failures, calls } = await runSession(["refusal"]);

      expect(SessionState.guards.failed(state) && state.failure).toContain("model_error");
      expect(calls).toHaveLength(1);
      expect(failures.map((failure) => failure.errorMessage)).toEqual([
        "Claude refused the request",
      ]);
    },
    generousRunMs,
  );

  it(
    "logs and retries a call the relay answered 503 while it was stopping",
    async () => {
      const { state, failures, calls } = await runSession(["stopping", "done"]);

      expect(SessionState.guards.idle(state)).toBe(true);
      expect(calls).toHaveLength(2);
      expect(failures).toHaveLength(1);
      expect(failures[0]?.errorMessage).toContain("503");
    },
    generousRunMs,
  );

  it(
    "turns a stream that ends with no closing event into a lost call that is logged and retried",
    async () => {
      const { state, failures, calls } = await runSession(["cut", "done"]);

      expect(SessionState.guards.idle(state)).toBe(true);
      expect(calls).toHaveLength(2);
      expect(failures).toHaveLength(1);
      expect(failures[0]?.errorMessage).toMatch(
        /^Claude relay lost the call \(connection lost\): /,
      );
    },
    generousRunMs,
  );

  it(
    "gives a subagent's call its own conversation",
    async () => {
      const { calls } = await runSession(["subagent", "done", "done"]);

      const [rootCall, subagentCall] = calls;

      expect(subagentCall?.body.options.sessionId).toBeDefined();
      expect(subagentCall?.body.options.sessionId).not.toBe(rootCall?.body.options.sessionId);
    },
    generousRunMs,
  );
});
