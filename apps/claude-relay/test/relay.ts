import { delimiter } from "node:path";
import { fileURLToPath } from "node:url";

import { CallId } from "@tentacles/relay-protocol/call-id";
import { StreamRequest } from "@tentacles/relay-protocol/stream-request";
import * as Schema from "effect/Schema";
import { vi } from "vitest";

import type { LogRecord } from "../src/log";
import { createRelay } from "../src/server";

const fakeClaudeFolder = fileURLToPath(new URL("fake-claude", import.meta.url));
const recording = fileURLToPath(new URL("fixtures/claude-turn.ndjson", import.meta.url));

/**
 * Starts the relay on a free port with the fake claude first on PATH, so pi-claude-code finds it the way
 * it finds the real CLI. Returns the relay's base URL, the end reports it sent and the records it
 * logged so far, a function that stops the relay as a signal would, and one that closes it.
 */
export const startRelay = async () => {
  vi.stubEnv("PATH", `${fakeClaudeFolder}${delimiter}${process.env.PATH ?? ""}`);
  vi.stubEnv("FAKE_CLAUDE_RECORDING", recording);

  const reportedEnds: Array<CallId> = [];
  const records: Array<LogRecord> = [];

  const relay = createRelay({
    egressCaPath: fileURLToPath(new URL("fixtures/no-egress-ca.crt", import.meta.url)),
    reportEnd: async (callId) => {
      reportedEnds.push(callId);
    },
    log: (record) => {
      records.push(record);
    },
  });

  await new Promise<void>((resolve) => relay.server.listen(0, "127.0.0.1", resolve));

  const { port } = Schema.decodeUnknownSync(Schema.Struct({ port: Schema.Int }))(
    relay.server.address(),
  );

  return {
    url: `http://127.0.0.1:${port}`,
    reportedEnds,
    records,
    stopServing: relay.stop,
    close: () => {
      relay.server.closeAllConnections();
      relay.server.close();
      vi.unstubAllEnvs();
    },
  };
};

export const newCallId = () => Schema.decodeSync(CallId)(crypto.randomUUID());

/** Who makes every call a test makes. */
export const sender = Schema.decodeSync(StreamRequest.fields.sender)({
  session: "0194b0a1-7d52-7c3e-8a41-5f2b9c6d1e30",
});

interface StreamBodyOptions {
  readonly prompt?: string;
  readonly conversation?: string;
}

export const streamBody = (modelId: string, { prompt, conversation }: StreamBodyOptions = {}) => {
  const options =
    conversation == null ? { reasoning: "low" } : { reasoning: "low", sessionId: conversation };

  return JSON.stringify({
    modelId,
    context: { messages: [{ role: "user", content: prompt ?? "Say hello.", timestamp: 0 }] },
    options,
    sender,
  });
};
