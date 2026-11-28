import { newCallId } from "@tentacles/relay-protocol/call-id";
import { afterEach, describe, expect, it } from "vitest";

import { CallOutcome } from "../src/call-outcome";
import { LogRecord } from "../src/log";
import { streamedEvents } from "./relay";
import { startRelayProcess } from "./relay-process";

let relay: Awaited<ReturnType<typeof startRelayProcess>> | undefined;

afterEach(() => {
  relay?.kill();
});

const startListeningRelayProcess = async (env: Record<string, string> = {}) => {
  const relayProcess = await startRelayProcess(env);

  relay = relayProcess;

  await relayProcess.waitForRecord(LogRecord.guards.RelayStart);

  return relayProcess;
};

describe("the relay process", () => {
  it("logs its start with the port it listens on", async () => {
    const relayProcess = await startListeningRelayProcess();

    expect(relayProcess.records.find(LogRecord.guards.RelayStart)?.port).toBe(relayProcess.port);
    expect((await fetch(relayProcess.url)).status).toBe(200);
  });

  it("logs the signal and exits cleanly on SIGTERM when no call is in flight", async () => {
    const relayProcess = await startListeningRelayProcess();

    relayProcess.signal("SIGTERM");

    expect(await relayProcess.exited).toEqual({ code: 0, signal: null });

    const signalIndex = relayProcess.records.findIndex(LogRecord.guards.RelaySignal);
    const exitIndex = relayProcess.records.findIndex(LogRecord.guards.RelayExit);

    expect(signalIndex).toBeGreaterThan(-1);
    expect(exitIndex).toBeGreaterThan(signalIndex);
    expect(relayProcess.records.find(LogRecord.guards.RelaySignal)?.signal).toBe("SIGTERM");
  });

  it.each(["SIGTERM", "SIGINT"] as const)(
    "ends a call in flight as lost and exits cleanly on %s",
    async (signal) => {
      const relayProcess = await startListeningRelayProcess({ FAKE_CLAUDE_DELAY_MS: "500" });
      const callId = newCallId();
      const response = await relayProcess.call({ callId });

      await relayProcess.waitForRecord(LogRecord.guards.CallStart);

      relayProcess.signal(signal);

      const lastEvent = streamedEvents(await response.text()).at(-1);

      expect(lastEvent?.type).toBe("error");
      expect(lastEvent?.reason).toBe("error");
      expect(lastEvent?.error?.errorMessage).toBe(
        "Claude relay lost the call (connection lost): the relay is stopping",
      );

      expect(await relayProcess.exited).toEqual({ code: 0, signal: null });

      const callEnd = relayProcess.records.find(LogRecord.guards.CallEnd);

      expect(callEnd?.callId).toBe(callId);
      expect(callEnd?.outcome).toEqual(CallOutcome.cases.Stopped.make({}));

      const signalIndex = relayProcess.records.findIndex(LogRecord.guards.RelaySignal);
      const endIndex = relayProcess.records.findIndex(LogRecord.guards.CallEnd);
      const exitIndex = relayProcess.records.findIndex(LogRecord.guards.RelayExit);

      expect(relayProcess.records.find(LogRecord.guards.RelaySignal)?.signal).toBe(signal);
      expect(endIndex).toBeGreaterThan(signalIndex);
      expect(exitIndex).toBeGreaterThan(endIndex);

      await expect(fetch(relayProcess.url)).rejects.toThrow("fetch failed");
    },
  );

  it("logs an exception thrown outside a call with its stack and keeps serving", async () => {
    const relayProcess = await startListeningRelayProcess();

    relayProcess.signal("SIGUSR2");

    const errorRecord = await relayProcess.waitForError("test hook: uncaught exception");

    expect(errorRecord.stack).toContain("test hook: uncaught exception");

    const response = await relayProcess.call();

    expect(streamedEvents(await response.text()).at(-1)?.type).toBe("done");
  });

  it("logs a rejection nobody handles with its stack and leaves the call in flight running", async () => {
    const relayProcess = await startListeningRelayProcess({ FAKE_CLAUDE_DELAY_MS: "300" });
    const response = await relayProcess.call();

    await relayProcess.waitForRecord(LogRecord.guards.CallStart);

    relayProcess.signal("SIGHUP");

    const errorRecord = await relayProcess.waitForError("test hook: unhandled rejection");

    expect(errorRecord.stack).toContain("test hook: unhandled rejection");
    expect(streamedEvents(await response.text()).at(-1)?.type).toBe("done");
  });
});
