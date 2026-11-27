import { Entry } from "@tentacles/worker-api/entries";
import { Parent } from "@tentacles/worker-api/parent";
import { SessionState, SessionStatuses } from "@tentacles/worker-api/session-state";
import type { Repository, Settings } from "@tentacles/worker-api/settings";
import { env } from "cloudflare:workers";
import * as Schema from "effect/Schema";

import { testSecrets } from "./secrets";

const api = "https://tentacles.asermax.com/api";

const headers = { authorization: `Bearer ${testSecrets.TENTACLES_API_KEY}` };

export const parent = Schema.decodeSync(Parent)({ harness: "pi", sessionId: "parent-session" });

/** A call to the Worker API with the key. */
export const apiFetch = (path: string, init: RequestInit = {}) => {
  const requestHeaders = new Headers(init.headers);

  requestHeaders.set("authorization", headers.authorization);

  return env.TENTACLES.fetch(`${api}${path}`, { ...init, headers: requestHeaders });
};

const statusOf = async (sessionId: string) => {
  const response = await apiFetch(`/sessions/${sessionId}/status`);

  return Schema.decodeUnknownSync(SessionState)(await response.json());
};

const isIdle = Schema.is(Schema.TaggedStruct(SessionStatuses.idle, {}));

/** Waits until the session's first run has finished; the test model answers at once. */
export const waitUntilIdle = async (sessionId: string) => {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (isIdle(await statusOf(sessionId))) {
      return;
    }

    await scheduler.wait(100);
  }

  throw new Error(`Session ${sessionId} never went idle`);
};

export const testSettings: Settings = {
  provider: "cloudflare",
  model: "glm-5.2",
  effort: "max",
  image: "default",
  size: "basic",
  repository: null,
};

/**
 * Creates a session under a known id through its object, as the Worker's SessionHost does, and
 * waits until its first run has finished.
 */
export const idleSession = async (
  sessionId: string,
  repository: Repository | null = null,
  prompt = "Say done.",
) => {
  await env.SessionObject.getByName(sessionId).create({
    name: "worker",
    parent,
    prompt,
    settings: { ...testSettings, repository },
  });

  await waitUntilIdle(sessionId);
};

interface ToolCall {
  readonly name: string;
  readonly arguments: Record<string, string>;
}

/** The prompt that makes the test model make these tool calls in order, then answer. */
export const scripted = (calls: ReadonlyArray<ToolCall>) =>
  `SCRIPT ${JSON.stringify(calls.map((call) => ({ ...call, arguments: JSON.stringify(call.arguments) })))}`;

const decodeEntries = Schema.decodeUnknownSync(Schema.Array(Entry));

/** The tool results of the session's last entries, oldest first. */
export const toolResults = async (sessionId: string, count = 30) => {
  const response = await apiFetch(`/sessions/${sessionId}/messages?count=${count}`);

  return decodeEntries(await response.json()).filter(Entry.guards.toolResult);
};

/** Sends a follow-up prompt and waits until the run it starts has answered. */
export const followUp = async (sessionId: string, text: string) => {
  const before = await answers(sessionId);

  await apiFetch(`/sessions/${sessionId}/prompt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, mode: "followUp" }),
  });

  for (let attempt = 0; attempt < 50; attempt++) {
    if ((await answers(sessionId)) > before) {
      return;
    }

    await scheduler.wait(100);
  }

  throw new Error(`Session ${sessionId} never answered the follow-up`);
};

const answers = async (sessionId: string) => {
  const response = await apiFetch(`/sessions/${sessionId}/messages?count=100`);

  return decodeEntries(await response.json()).filter(Entry.guards.text).length;
};
