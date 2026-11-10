import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CLAUDE_CODE_MODELS } from "@earendil-works/pi-claude-code/src/model-catalog.ts";
import * as Schema from "effect/Schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startRelay, streamBody } from "./relay.ts";

let relay: Awaited<ReturnType<typeof startRelay>>;

beforeEach(async () => {
  relay = await startRelay();
});

afterEach(() => {
  relay.stop();
});

const post = (modelId: string, signal?: AbortSignal) =>
  fetch(`${relay.url}/stream`, {
    method: "POST",
    body: streamBody(modelId),
    signal: signal ?? null,
  });

// The fields of pi-ai's AssistantMessageEvent the assertions read.
const StreamedEvent = Schema.Struct({
  type: Schema.String,
  delta: Schema.optionalKey(Schema.String),
  message: Schema.optionalKey(Schema.Struct({ content: Schema.Array(Schema.Unknown) })),
});

const events = (body: string) =>
  body
    .trim()
    .split("\n")
    .map((line) => Schema.decodeSync(Schema.fromJsonString(StreamedEvent))(line));

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

describe("POST /stream", () => {
  it("streams the CLI's answer as one pi-ai event per line, ending with done", async () => {
    const response = await post("claude-sonnet-5-5");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/x-ndjson");

    const streamed = events(await response.text());
    const last = streamed.at(-1);

    expect(streamed[0]?.type).toBe("start");
    expect(streamed.filter((event) => event.type === "done")).toHaveLength(1);
    expect(last?.type).toBe("done");

    const text = streamed
      .flatMap((event) => (event.type === "text_delta" ? [event.delta] : []))
      .join("");

    expect(text).toBe("Hello from the relay.");
    expect(last?.message?.content).toEqual([{ type: "text", text: "Hello from the relay." }]);
  });

  it("streams a model that only the CLI's catalog lists", async () => {
    const response = await post("claude-sonnet-4-6");

    expect(response.status).toBe(200);
    expect(events(await response.text()).at(-1)?.type).toBe("done");
  });

  it("answers 400 for a model neither pi-claude-code's catalog nor the CLI's lists", async () => {
    const response = await post("claude-unknown-9");

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("unknown model claude-unknown-9");
  });

  it("aborts the CLI call when the caller hangs up", async () => {
    const pids = join(await mkdtemp(join(tmpdir(), "claude-relay-")), "pids");

    vi.stubEnv("FAKE_CLAUDE_DELAY_MS", "500");
    vi.stubEnv("FAKE_CLAUDE_PIDS", pids);

    const caller = new AbortController();
    const response = await post("claude-sonnet-5-5", caller.signal);

    expect(response.status).toBe(200);

    const pid = await vi.waitFor(async () => Number((await readFile(pids, "utf8")).trim()), {
      timeout: 5_000,
    });

    expect(isAlive(pid)).toBe(true);

    caller.abort();

    await vi.waitFor(() => expect(isAlive(pid)).toBe(false), { timeout: 5_000 });
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
