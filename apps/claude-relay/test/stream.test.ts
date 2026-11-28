import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CLAUDE_CODE_MODELS } from "@earendil-works/pi-claude-code/src/model-catalog.ts";
import { callIdHeader, newCallId, type CallId } from "@tentacles/relay-protocol/call-id";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CallOutcome } from "../src/call-outcome";
import { LogRecord } from "../src/log";
import { sender, startRelay, streamBody, streamedEvents } from "./relay";

let relay: Awaited<ReturnType<typeof startRelay>>;

beforeEach(async () => {
  relay = await startRelay();
});

afterEach(() => {
  relay.close();
});

const post = (modelId: string, signal?: AbortSignal) =>
  fetch(`${relay.url}/stream`, {
    method: "POST",
    body: streamBody(modelId),
    signal: signal ?? null,
  });

// A call the Claude object counted: it carries the call id the relay reports back.
const postCounted = (callId: string, body: string, signal?: AbortSignal) =>
  fetch(`${relay.url}/stream`, {
    method: "POST",
    headers: { [callIdHeader]: callId },
    body,
    signal: signal ?? null,
  });

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

const lostCallPrefix = "Claude relay lost the call (connection lost): ";

const outcomeOf = (callId: CallId) =>
  relay.records
    .flatMap((record) =>
      LogRecord.guards.CallEnd(record) && record.callId === callId ? [record.outcome] : [],
    )
    .at(0);

// A slow call, whose CLI process the test finds through the pid file the fake CLI writes.
const slowCallPidFile = async () => {
  const pidFilePath = join(await mkdtemp(join(tmpdir(), "claude-relay-")), "pids");

  vi.stubEnv("FAKE_CLAUDE_DELAY_MS", "500");
  vi.stubEnv("FAKE_CLAUDE_PIDS", pidFilePath);

  return pidFilePath;
};

const waitForPid = (pidFilePath: string) =>
  vi.waitFor(async () => Number((await readFile(pidFilePath, "utf8")).trim()), { timeout: 5_000 });

// A counted call whose CLI fails in the given way, and the error message its stream ends with.
const failedCall = async (failure: string) => {
  const callId = newCallId();

  const response = await postCounted(
    callId,
    streamBody("claude-sonnet-5-5", { prompt: `FAKE_CLAUDE_FAIL=${failure}` }),
  );

  return {
    callId,
    errorMessage: streamedEvents(await response.text()).at(-1)?.error?.errorMessage,
  };
};

describe("POST /stream", () => {
  it("streams the CLI's answer as one pi-ai event per line, ending with done", async () => {
    const response = await post("claude-sonnet-5-5");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/x-ndjson");

    const streamed = streamedEvents(await response.text());
    const lastEvent = streamed.at(-1);

    expect(streamed[0]?.type).toBe("start");
    expect(streamed.filter((event) => event.type === "done")).toHaveLength(1);
    expect(lastEvent?.type).toBe("done");

    const text = streamed
      .flatMap((event) => (event.type === "text_delta" ? [event.delta] : []))
      .join("");

    expect(text).toBe("Hello from the relay.");
    expect(lastEvent?.message?.content).toEqual([{ type: "text", text: "Hello from the relay." }]);
    expect(relay.reportedEnds).toEqual([]);
  });

  it("streams a model that only the CLI's catalog lists", async () => {
    const response = await post("claude-sonnet-4-6");

    expect(response.status).toBe(200);
    expect(streamedEvents(await response.text()).at(-1)?.type).toBe("done");
  });

  it("answers 400 for a model neither pi-claude-code's catalog nor the CLI's lists", async () => {
    const response = await post("claude-unknown-9");

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("claude-unknown-9");
  });

  it("aborts the CLI call when the caller hangs up", async () => {
    const pidFilePath = await slowCallPidFile();
    const caller = new AbortController();
    const response = await post("claude-sonnet-5-5", caller.signal);

    expect(response.status).toBe(200);

    const pid = await waitForPid(pidFilePath);

    expect(isAlive(pid)).toBe(true);

    caller.abort();

    await vi.waitFor(() => expect(isAlive(pid)).toBe(false), { timeout: 5_000 });
  });

  it("logs the start and the end of a counted call without its prompt or output, and reports its end", async () => {
    const callId = newCallId();
    const conversation = crypto.randomUUID();

    const response = await postCounted(callId, streamBody("claude-sonnet-5-5", { conversation }));

    expect(streamedEvents(await response.text()).at(-1)?.type).toBe("done");

    await vi.waitFor(() => expect(relay.reportedEnds).toEqual([callId]));

    expect(relay.records).toEqual([
      LogRecord.cases.CallStart.make({
        callId,
        sender,
        conversation,
        modelId: "claude-sonnet-5-5",
      }),
      LogRecord.cases.CallEnd.make({
        callId,
        sender,
        conversation,
        outcome: CallOutcome.cases.Done.make({}),
      }),
    ]);
    expect(JSON.stringify(relay.records)).not.toContain("Say hello.");
    expect(JSON.stringify(relay.records)).not.toContain("Hello from the relay.");
  });

  it("reports the end of a counted call for a model it does not know", async () => {
    const callId = newCallId();
    const response = await postCounted(callId, streamBody("claude-unknown-9"));

    expect(response.status).toBe(400);

    await vi.waitFor(() => expect(relay.reportedEnds).toEqual([callId]));

    expect(relay.records).toEqual([
      LogRecord.cases.CallEnd.make({
        callId,
        outcome: CallOutcome.cases.Failed.make({ errorMessage: "unknown model claude-unknown-9" }),
      }),
    ]);
  });

  it("reports the end of a counted call whose body is invalid", async () => {
    const callId = newCallId();
    const response = await postCounted(callId, "not a request");

    expect(response.status).toBe(400);

    await vi.waitFor(() => expect(relay.reportedEnds).toEqual([callId]));
  });

  it("ends a call the CLI lost to a signal as lost, and keeps streaming the other calls", async () => {
    vi.stubEnv("FAKE_CLAUDE_DELAY_MS", "200");

    const lostCallId = newCallId();
    const otherCallId = newCallId();

    const [lostCallResponse, otherCallResponse] = await Promise.all([
      postCounted(
        lostCallId,
        streamBody("claude-sonnet-5-5", { prompt: "FAKE_CLAUDE_FAIL=signal" }),
      ),
      postCounted(otherCallId, streamBody("claude-sonnet-5-5")),
    ]);

    const lostEvents = streamedEvents(await lostCallResponse.text());
    const lastLost = lostEvents.at(-1);

    expect(lastLost?.type).toBe("error");
    expect(lastLost?.reason).toBe("error");
    expect(lastLost?.error?.errorMessage).toBe(
      "Claude relay lost the call (connection lost): Claude Code exited from signal SIGTERM",
    );
    expect(streamedEvents(await otherCallResponse.text()).at(-1)?.type).toBe("done");

    await vi.waitFor(() => expect(relay.reportedEnds).toHaveLength(2));

    expect(relay.reportedEnds).toContain(lostCallId);
    expect(outcomeOf(lostCallId)).toEqual(
      CallOutcome.cases.Lost.make({
        errorMessage:
          "Claude relay lost the call (connection lost): Claude Code exited from signal SIGTERM",
      }),
    );
  });

  it("ends a call whose CLI exited with code 143 as lost", async () => {
    const { callId, errorMessage } = await failedCall("exit-143");

    expect(errorMessage).toMatch(/^Claude relay lost the call \(connection lost\): .*exit 143/);

    await vi.waitFor(() => expect(outcomeOf(callId)).toSatisfy(CallOutcome.guards.Lost));
  });

  it("keeps the message of a call whose upstream connection was lost, which already reads as lost", async () => {
    const { callId, errorMessage } = await failedCall("no-message-stop");

    expect(errorMessage).toMatch(/^Incomplete Claude Code response: .*: connection lost$/);

    await vi.waitFor(() => expect(outcomeOf(callId)).toSatisfy(CallOutcome.guards.Lost));
  });

  it("keeps the message of a call the API refused and ends it as failed", async () => {
    const { callId, errorMessage } = await failedCall("api-error");

    expect(errorMessage).toContain("API Error: 400");
    expect(errorMessage).not.toContain(lostCallPrefix);

    await vi.waitFor(() => expect(outcomeOf(callId)).toSatisfy(CallOutcome.guards.Failed));
  });

  it("aborts the CLI of a counted call when the caller hangs up, and reports its end once", async () => {
    const pidFilePath = await slowCallPidFile();
    const callId = newCallId();
    const caller = new AbortController();
    const response = await postCounted(callId, streamBody("claude-sonnet-5-5"), caller.signal);

    expect(response.status).toBe(200);

    const pid = await waitForPid(pidFilePath);

    caller.abort();

    await vi.waitFor(() => expect(isAlive(pid)).toBe(false), { timeout: 5_000 });
    await vi.waitFor(() => expect(relay.reportedEnds).toEqual([callId]));

    expect(outcomeOf(callId)).toEqual(CallOutcome.cases.Aborted.make({}));
  });

  it("answers 503 with the lost-call wording to a call that reaches a stopping relay", async () => {
    await relay.stopServing();

    const response = await postCounted(newCallId(), streamBody("claude-sonnet-5-5"));

    expect(response.status).toBe(503);
    expect(await response.text()).toMatch(/^Claude relay lost the call \(connection lost\): /);
    expect(relay.reportedEnds).toEqual([]);
  });
});

describe("GET /", () => {
  it("answers ok with pi-claude-code's catalog", async () => {
    const response = await fetch(relay.url);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      models: CLAUDE_CODE_MODELS.map((model) => model.id),
    });
  });
});
