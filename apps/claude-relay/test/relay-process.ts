import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { delimiter } from "node:path";
import { fileURLToPath } from "node:url";

import { callIdHeader } from "@tentacles/relay-protocol/call-id";
import * as Schema from "effect/Schema";
import { vi } from "vitest";

import { LogRecord } from "../src/log";
import { newCallId, streamBody } from "./relay";

const bundle = fileURLToPath(new URL("../dist/main.js", import.meta.url));
const fakeClaudeFolder = fileURLToPath(new URL("fake-claude", import.meta.url));
const recording = fileURLToPath(new URL("fixtures/claude-turn.ndjson", import.meta.url));
const failureHook = fileURLToPath(new URL("hooks/fail-outside-a-call.mjs", import.meta.url));
const egressCa = fileURLToPath(new URL("fixtures/no-egress-ca.crt", import.meta.url));

const decodeRecord = Schema.decodeUnknownSync(Schema.fromJsonString(LogRecord));

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = Schema.decodeUnknownSync(Schema.Struct({ port: Schema.Int }))(
        server.address(),
      );

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

  const child = spawn(process.execPath, [bundle], {
    env: {
      ...process.env,
      ...env,
      PORT: String(port),
      EGRESS_CA_PATH: egressCa,
      PATH: `${fakeClaudeFolder}${delimiter}${process.env.PATH ?? ""}`,
      FAKE_CLAUDE_RECORDING: recording,
      NODE_OPTIONS: `--import ${failureHook}`,
    },
    stdio: ["ignore", "pipe", "inherit"],
  });

  const records: Array<LogRecord> = [];
  let pending = "";

  child.stdout.on("data", (chunk) => {
    pending += String(chunk);

    const lines = pending.split("\n");

    pending = lines.pop() ?? "";

    for (const line of lines) {
      records.push(decodeRecord(line));
    }
  });

  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });

  const url = `http://127.0.0.1:${port}`;

  return {
    url,
    port,
    records,
    exited,
    signal: (signal: NodeJS.Signals) => child.kill(signal),

    /** Waits for the first record the guard accepts, and returns it. */
    waitForRecord: <Match extends LogRecord>(isMatch: (record: LogRecord) => record is Match) =>
      vi.waitFor(
        () => {
          const record = records.find(isMatch);

          if (record == null) {
            throw new Error("The relay has not logged that record yet");
          }

          return record;
        },
        { timeout: 10_000 },
      ),

    /** Waits for the first Error record whose message holds the text, and returns it. */
    waitForError: (text: string) =>
      vi.waitFor(
        () => {
          const error = records
            .flatMap((record) =>
              LogRecord.guards.Error(record) && record.errorMessage.includes(text) ? [record] : [],
            )
            .at(0);

          if (error == null) {
            throw new Error(`The relay has not logged an error about ${text} yet`);
          }

          return error;
        },
        { timeout: 10_000 },
      ),

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
