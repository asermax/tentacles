import { lostCallMessage } from "@tentacles/relay-protocol/lost-call";
import { afterEach, describe, expect, it } from "vitest";

import { CallOutcome } from "../src/call-outcome";
import { LogRecord } from "../src/log";
import { newCallId, streamedEvents } from "./relay";
import { startRelayProcess } from "./relay-process";

let relay: Awaited<ReturnType<typeof startRelayProcess>> | undefined;

afterEach(() => {
  relay?.kill();
});

const started = async (env: Record<string, string> = {}) => {
  const process = await startRelayProcess(env);

  relay = process;

  await process.waitForRecord(LogRecord.guards.RelayStart);

  return process;
};

const indexOfRecord = (
  process: Awaited<ReturnType<typeof startRelayProcess>>,
  isMatch: (record: LogRecord) => boolean,
) => process.records.findIndex(isMatch);

describe("the relay process", () => {
  it("logs its start with the port it listens on", async () => {
    const process = await startRelayProcess();

    relay = process;

    const start = await process.waitForRecord(LogRecord.guards.RelayStart);

    expect(start.port).toBe(process.port);
    expect((await fetch(process.url)).status).toBe(200);
  });

  it("logs the signal and exits cleanly on SIGTERM when no call is in flight", async () => {
    const process = await started();

    process.signal("SIGTERM");

    expect(await process.exited).toEqual({ code: 0, signal: null });

    const signalIndex = indexOfRecord(process, LogRecord.guards.RelaySignal);
    const exitIndex = indexOfRecord(process, LogRecord.guards.RelayExit);

    expect(signalIndex).toBeGreaterThan(-1);
    expect(exitIndex).toBeGreaterThan(signalIndex);
    expect(process.records.find(LogRecord.guards.RelaySignal)?.signal).toBe("SIGTERM");
  });

  it.each(["SIGTERM", "SIGINT"] as const)(
    "ends a call in flight as lost and exits cleanly on %s",
    async (signal) => {
      const process = await started({ FAKE_CLAUDE_DELAY_MS: "500" });
      const callId = newCallId();
      const response = await process.call({ callId });

      await process.waitForRecord(LogRecord.guards.CallStart);

      process.signal(signal);

      const last = streamedEvents(await response.text()).at(-1);

      expect(last?.type).toBe("error");
      expect(last?.reason).toBe("error");
      expect(last?.error?.errorMessage).toBe(lostCallMessage("the relay is stopping"));

      expect(await process.exited).toEqual({ code: 0, signal: null });

      const callEnd = process.records.find(LogRecord.guards.CallEnd);

      expect(callEnd?.callId).toBe(callId);
      expect(callEnd?.outcome).toEqual(CallOutcome.cases.Stopped.make({}));

      const signalIndex = indexOfRecord(process, LogRecord.guards.RelaySignal);
      const endIndex = indexOfRecord(process, LogRecord.guards.CallEnd);
      const exitIndex = indexOfRecord(process, LogRecord.guards.RelayExit);

      expect(process.records.find(LogRecord.guards.RelaySignal)?.signal).toBe(signal);
      expect(endIndex).toBeGreaterThan(signalIndex);
      expect(exitIndex).toBeGreaterThan(endIndex);

      await expect(fetch(process.url)).rejects.toThrow("fetch failed");
    },
  );

  it("logs an exception thrown outside a call with its stack and keeps serving", async () => {
    const process = await started();

    process.signal("SIGUSR2");

    const error = await process.waitForError("test hook: uncaught exception");

    expect(error.stack).toContain("test hook: uncaught exception");

    const response = await process.call();

    expect(streamedEvents(await response.text()).at(-1)?.type).toBe("done");
  });

  it("logs a rejection nobody handles with its stack and leaves the call in flight running", async () => {
    const process = await started({ FAKE_CLAUDE_DELAY_MS: "300" });
    const response = await process.call();

    await process.waitForRecord(LogRecord.guards.CallStart);

    process.signal("SIGHUP");

    const error = await process.waitForError("test hook: unhandled rejection");

    expect(error.stack).toContain("test hook: unhandled rejection");
    expect(streamedEvents(await response.text()).at(-1)?.type).toBe("done");
  });
});
