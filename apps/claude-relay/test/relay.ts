import type { Server } from "node:net";
import { delimiter } from "node:path";
import { fileURLToPath } from "node:url";

import type { CallId } from "@tentacles/relay-protocol/call-id";
import { StreamRequest } from "@tentacles/relay-protocol/stream-request";
import * as Schema from "effect/Schema";
import { vi } from "vitest";

import type { LogRecord } from "../src/log";
import { createRelay } from "../src/server";

export const fakeClaudeFolder = fileURLToPath(new URL("fake-claude", import.meta.url));

export const claudeRecordingPath = fileURLToPath(
  new URL("fixtures/claude-turn.ndjson", import.meta.url),
);

export const egressCaPath = fileURLToPath(new URL("fixtures/no-egress-ca.crt", import.meta.url));

/** The port a listening server is bound to. */
export const listeningPort = (server: Server) =>
  Schema.decodeUnknownSync(Schema.Struct({ port: Schema.Int }))(server.address()).port;

/**
 * Starts the relay on a free port with the fake claude first on PATH, so pi-claude-code finds it the way
 * it finds the real CLI. Returns the relay's base URL, the end reports it sent and the records it
 * logged so far, a function that stops the relay as a signal would, and one that closes it.
 */
export const startRelay = async () => {
  vi.stubEnv("PATH", `${fakeClaudeFolder}${delimiter}${process.env.PATH ?? ""}`);
  vi.stubEnv("FAKE_CLAUDE_RECORDING", claudeRecordingPath);

  const reportedEnds: Array<CallId> = [];
  const records: Array<LogRecord> = [];

  const relay = createRelay({
    egressCaPath,
    reportEnd: async (callId) => {
      reportedEnds.push(callId);
    },
    log: (record) => {
      records.push(record);
    },
  });

  await new Promise<void>((resolve) => relay.server.listen(0, "127.0.0.1", resolve));

  return {
    url: `http://127.0.0.1:${listeningPort(relay.server)}`,
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

/** Who makes every call a test makes. */
export const sender = Schema.decodeSync(StreamRequest.fields.sender)({
  session: "0194b0a1-7d52-7c3e-8a41-5f2b9c6d1e30",
});

interface StreamBodyOptions {
  readonly prompt?: string;
  readonly conversation?: string;
}

export const streamBody = (modelId: string, { prompt, conversation }: StreamBodyOptions = {}) =>
  JSON.stringify({
    modelId,
    context: { messages: [{ role: "user", content: prompt ?? "Say hello.", timestamp: 0 }] },
    options: { reasoning: "low", sessionId: conversation },
    sender,
  });

// The fields of pi-ai's AssistantMessageEvent the assertions read.
const StreamedEvent = Schema.Struct({
  type: Schema.String,
  delta: Schema.optionalKey(Schema.String),
  reason: Schema.optionalKey(Schema.String),
  message: Schema.optionalKey(Schema.Struct({ content: Schema.Array(Schema.Unknown) })),
  error: Schema.optionalKey(Schema.Struct({ errorMessage: Schema.optionalKey(Schema.String) })),
});

export const streamedEvents = (body: string) =>
  body
    .trim()
    .split("\n")
    .map((line) => Schema.decodeSync(Schema.fromJsonString(StreamedEvent))(line));
