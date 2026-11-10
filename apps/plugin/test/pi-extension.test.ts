import { SessionNotFound } from "@tentacles/worker-api/errors";
import { SessionRef, SessionStatuses } from "@tentacles/worker-api/session-state";
import * as Schema from "effect/Schema";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Failure, Success } from "../src/core/helper-output.ts";
import { LocalState } from "../src/core/local-state.ts";
import { tentaclesExtension } from "../src/pi/extension.ts";
import type {
  PiContext,
  PiExtensionApi,
  PiSessionEntry,
  PiSessionStartHandler,
  PiShutdownHandler,
  PiTool,
} from "../src/pi/pi-api.ts";
import { createFakeHelper, type FakeHelper } from "./fake-helper.ts";
import { questionOf, sessionIdOf, Waiting } from "./values.ts";

const sessionId = sessionIdOf(1);

const migrate = SessionRef.make({ sessionId, name: "migrate", status: SessionStatuses.running });

const encodeState = Schema.encodeSync(LocalState);

/** A pi host that records what the extension does, with one session whose branch holds `entries`. */
const createFakePi = (entries: Array<PiSessionEntry>, hasUI = true) => {
  const tools = new Map<string, PiTool>();
  const messages: Array<{ readonly content: string; readonly triggerTurn: boolean }> = [];
  const widgets: Array<ReadonlyArray<string> | undefined> = [];

  const handlers: Array<PiSessionStartHandler> = [];

  const shutdown: Array<PiShutdownHandler> = [];

  const pi: PiExtensionApi = {
    on: (event: string, handler: PiSessionStartHandler) => {
      if (event === "session_shutdown") {
        shutdown.push(() => handler({ reason: "quit" }, ctx));
      } else {
        handlers.push(handler);
      }
    },
    registerTool: (tool) => tools.set(tool.name, tool),
    sendMessage: (message, options) =>
      messages.push({ content: message.content, triggerTurn: options.triggerTurn }),
    appendEntry: (customType, data) => entries.push({ type: "custom", customType, data }),
  };

  const ctx: PiContext = {
    hasUI,
    ui: { setWidget: (_key, content) => widgets.push(content) },
    sessionManager: { getSessionId: () => "pi-session", getBranch: () => entries },
  };

  return {
    pi,
    tools,
    messages,
    widgets,
    entries,
    start: () => handlers.forEach((handler) => handler({ reason: "startup" }, ctx)),
    stop: () => shutdown.forEach((stop) => stop()),
  };
};

let host: ReturnType<typeof createFakePi> | undefined;

const load = (helper: FakeHelper, entries: Array<PiSessionEntry>) => {
  process.env.TENTACLES_HELPER = helper.path;
  host = createFakePi(entries);
  tentaclesExtension(host.pi);

  return host;
};

afterEach(() => {
  host?.stop();
  host = undefined;
  delete process.env.TENTACLES_HELPER;
});

describe("pi extension", () => {
  it("registers every tool as tentacles_<name>, wait included", () => {
    const pi = load(createFakeHelper({}), []);

    expect([...pi.tools.keys()].toSorted((left, right) => left.localeCompare(right))).toEqual([
      "tentacles_answer",
      "tentacles_close",
      "tentacles_list",
      "tentacles_messages",
      "tentacles_prompt",
      "tentacles_spawn",
      "tentacles_wait",
    ]);
  });

  it("keeps the local state in a custom session entry, wakes through sendMessage and shows open sessions in the widget", async () => {
    const waiting = Waiting.make({ question: questionOf("q-3", "Which branch?") });

    const helper = createFakeHelper({ list: Success.make({ result: [migrate] }) }, [
      { sessionId, state: waiting },
    ]);

    const pi = load(helper, [
      { type: "custom", customType: "tentacles-state", data: encodeState({ sessions: [migrate] }) },
    ]);

    pi.start();
    await vi.waitFor(() => expect(pi.messages).not.toHaveLength(0), {
      timeout: 2000,
      interval: 20,
    });

    expect(helper.calls()).toEqual([
      ["list", JSON.stringify({ parent: { harness: "pi", sessionId: "pi-session" } })],
      ["watch", sessionId],
    ]);
    expect(pi.messages).toEqual([
      { content: expect.stringContaining("Which branch?"), triggerTurn: true },
    ]);
    expect(pi.widgets.at(-1)).toEqual(["migrate: waiting"]);
    expect(pi.entries.at(-1)).toEqual({
      type: "custom",
      customType: "tentacles-state",
      data: encodeState({ sessions: [{ ...migrate, status: SessionStatuses.waiting }] }),
    });
  });

  it("fails the tool with the error's code and message on a Failure result", async () => {
    const helper = createFakeHelper({
      close: Failure.make({ error: new SessionNotFound({ sessionId }) }),
    });

    const pi = load(helper, []);

    pi.start();

    await expect(
      pi.tools.get("tentacles_close")?.execute("call-1", { sessionId }, undefined),
    ).rejects.toThrow(`SessionNotFound: session ${sessionId} does not exist.`);
  });
});
