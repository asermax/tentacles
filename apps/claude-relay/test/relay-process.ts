import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { delimiter } from "node:path";
import { fileURLToPath } from "node:url";

import { callIdHeader, newCallId } from "@tentacles/relay-protocol/call-id";
import * as Schema from "effect/Schema";
import { vi } from "vitest";

import { LogRecord } from "../src/log";
import {
  egressCaPath,
  fakeClaudeFolder,
  listeningPort,
  claudeRecordingPath,
  streamBody,
} from "./relay";

const relayBundlePath = fileURLToPath(new URL("../dist/main.js", import.meta.url));
const failureHookPath = fileURLToPath(new URL("hooks/fail-outside-a-call.mjs", import.meta.url));

const decodeRecord = Schema.decodeUnknownSync(Schema.fromJsonString(LogRecord));

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = listeningPort(server);

      server.close(() => resolve(port));
    });
  });

/**
 * Runs the built relay as a process of its own, with the fake claude first on PATH and a hook
 * preloaded that fails the process on SIGUSR2 (an exception) or SIGHUP (a rejection). Returns what the
 * process logged, how it ended, and a way to make a call to it.
 */
export const startRelayProcess = async (env: Record<string, string> = {}) => {
  const port = await freePort();

  const child = spawn(process.execPath, [relayBundlePath], {
    env: {
      ...process.env,
      ...env,
      PORT: String(port),
      EGRESS_CA_PATH: egressCaPath,
      PATH: `${fakeClaudeFolder}${delimiter}${process.env.PATH ?? ""}`,
      FAKE_CLAUDE_RECORDING: claudeRecordingPath,
      NODE_OPTIONS: `--import ${failureHookPath}`,
    },
    stdio: ["ignore", "pipe", "inherit"],
  });

  const records: Array<LogRecord> = [];
  let unterminatedStdout = "";

  child.stdout.on("data", (chunk) => {
    unterminatedStdout += String(chunk);

    const stdoutLines = unterminatedStdout.split("\n");

    unterminatedStdout = stdoutLines.pop() ?? "";

    for (const line of stdoutLines) {
      records.push(decodeRecord(line));
    }
  });

  const exitResultPromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve) => {
      child.once("exit", (code, signal) => resolve({ code, signal }));
    },
  );

  const url = `http://127.0.0.1:${port}`;

  /** Waits for the first record the guard accepts and the condition holds for, and returns it. */
  const waitForRecord = <Match extends LogRecord>(
    isMatch: (record: LogRecord) => record is Match,
    satisfies: (match: Match) => boolean = () => true,
  ) =>
    vi.waitFor(
      () => {
        const record = records.filter(isMatch).find(satisfies);

        if (record == null) {
          throw new Error("The relay has not logged that record yet");
        }

        return record;
      },
      { timeout: 10_000 },
    );

  return {
    url,
    port,
    records,
    exitResultPromise,
    signal: (signal: NodeJS.Signals) => child.kill(signal),

    waitForRecord,

    /** Waits for the first Error record whose message holds the text, and returns it. */
    waitForError: (text: string) =>
      waitForRecord(LogRecord.guards.Error, (record) => record.errorMessage.includes(text)),

    /** A counted call to the relay; the response's body ends when the call does. */
    call: (init: { callId?: string; prompt?: string } = {}) =>
      fetch(`${url}/stream`, {
        method: "POST",
        headers: { [callIdHeader]: init.callId ?? newCallId() },
        body: streamBody("claude-sonnet-5-5", init.prompt == null ? {} : { prompt: init.prompt }),
      }),

    kill: () => child.kill("SIGKILL"),
  };
};
