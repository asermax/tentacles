import { delimiter } from "node:path";
import { fileURLToPath } from "node:url";

import * as Schema from "effect/Schema";
import { vi } from "vitest";

import { relayServer } from "../src/server.ts";

const fakeClaudeFolder = fileURLToPath(new URL("fake-claude", import.meta.url));
const recording = fileURLToPath(new URL("fixtures/claude-turn.ndjson", import.meta.url));

/**
 * Starts the relay on a free port with the fake claude first on PATH, so pi-claude-code finds it the way
 * it finds the real CLI. Returns the relay's base URL and a function that stops it.
 */
export const startRelay = async () => {
  vi.stubEnv("PATH", `${fakeClaudeFolder}${delimiter}${process.env.PATH ?? ""}`);
  vi.stubEnv("FAKE_CLAUDE_RECORDING", recording);

  const server = relayServer(fileURLToPath(new URL("fixtures/no-egress-ca.crt", import.meta.url)));

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const { port } = Schema.decodeUnknownSync(Schema.Struct({ port: Schema.Int }))(server.address());

  return {
    url: `http://127.0.0.1:${port}`,
    stop: () => {
      server.closeAllConnections();
      server.close();
      vi.unstubAllEnvs();
    },
  };
};

export const streamBody = (modelId: string) =>
  JSON.stringify({
    modelId,
    context: { messages: [{ role: "user", content: "Say hello.", timestamp: 0 }] },
    options: { reasoning: "low" },
  });
