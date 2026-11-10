import { SessionNotFound } from "@tentacles/worker-api/errors";
import { Harnesses } from "@tentacles/worker-api/parent";
import { SessionRef, SessionStatuses } from "@tentacles/worker-api/session-state";
import { describe, expect, it } from "vitest";

import { createController } from "../src/core/controller.ts";
import { Failure, Success, type CommandResult } from "../src/core/helper-output.ts";
import type { LocalState } from "../src/core/local-state.ts";
import { createFakeGlue } from "./fake-glue.ts";
import { Failed, Idle, questionOf, Running, sessionIdOf, TextEntry, Waiting } from "./values.ts";

const ref = (session: SessionRef) => SessionRef.make(session);

const [first, second, third] = [sessionIdOf(1), sessionIdOf(2), sessionIdOf(3)];

const local = (...sessions: ReadonlyArray<SessionRef>): LocalState => ({ sessions });

const migrate = ref({ sessionId: first, name: "migrate", status: SessionStatuses.running });

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const started = async (
  initial: LocalState,
  results: Partial<Record<string, CommandResult>> = {},
  interactive = true,
) => {
  const glue = createFakeGlue(initial, results);
  const controller = createController(glue, Harnesses.pi);

  await controller.start({ parentSessionId: "parent-session", interactive });

  return glue;
};

describe("parent controller at harness start", () => {
  it("makes no list call and watches nothing when the local state is empty", async () => {
    const glue = await started(local());

    expect(glue.commands).toEqual([]);
    expect(glue.watches).toEqual([]);
  });

  it("replaces the local state with the parent's list: a deleted session drops and a closed one comes back closed", async () => {
    const listed = [
      ref({ sessionId: first, name: "migrate", status: SessionStatuses.closed }),
      ref({ sessionId: third, name: "docs", status: SessionStatuses.idle }),
    ];

    const glue = await started(
      local(migrate, ref({ sessionId: second, name: "gone", status: SessionStatuses.running })),
      { list: Success.make({ result: listed }) },
    );

    expect(glue.commands).toEqual([
      ["list", JSON.stringify({ parent: { harness: "pi", sessionId: "parent-session" } })],
    ]);
    expect(glue.states.at(-1)).toEqual({ sessions: listed });
    expect(glue.statusLines.at(-1)).toBe("docs: idle");
    expect(glue.watches).toEqual([[third]]);
  });

  it("empties the local state of a forked parent, whose list is empty", async () => {
    const glue = await started(local(migrate), { list: Success.make({ result: [] }) });

    expect(glue.states.at(-1)).toEqual({ sessions: [] });
    expect(glue.statusLines.at(-1)).toBeUndefined();
    expect(glue.watches).toEqual([]);
  });

  it("starts no watch and wakes nobody for a headless parent", async () => {
    const glue = await started(
      local(migrate),
      { list: Success.make({ result: [migrate] }) },
      false,
    );

    glue.emit({ sessionId: first, state: Failed.make({ failure: "boom" }) });

    expect(glue.watches).toEqual([]);
    expect(glue.wakes).toEqual([]);
  });

  it("wakes the parent with the last message of a session that finished while it was away, once", async () => {
    const finished = ref({ ...migrate, status: SessionStatuses.idle });
    const glue = await started(local(migrate), { list: Success.make({ result: [finished] }) });

    const line = {
      sessionId: first,
      state: Idle.make({ lastEntry: TextEntry.make({ text: "Opened PR 12." }) }),
    };

    glue.emit(line);
    glue.emit(line);

    expect(glue.wakes).toEqual([expect.stringContaining("Opened PR 12.")]);
  });

  it("does not wake the parent again for a session it already saw finish", async () => {
    const finished = ref({ ...migrate, status: SessionStatuses.idle });
    const glue = await started(local(finished), { list: Success.make({ result: [finished] }) });

    glue.emit({
      sessionId: first,
      state: Idle.make({ lastEntry: TextEntry.make({ text: "Opened PR 12." }) }),
    });

    expect(glue.wakes).toEqual([]);
  });
});

describe("parent controller on a tool result", () => {
  it("adds a spawned session and restarts the watch with it", async () => {
    const glue = await started(local(), { spawn: Success.make({ result: { sessionId: second } }) });

    const outcome = await glue.call("spawn", { name: "docs", prompt: "write them" });

    expect(outcome.isError).toBe(false);
    expect(glue.commands.at(-1)?.[0]).toBe("spawn");
    expect(JSON.parse(glue.commands.at(-1)?.[1] ?? "")).toEqual({
      name: "docs",
      prompt: "write them",
      parent: { harness: "pi", sessionId: "parent-session" },
    });
    expect(glue.states.at(-1)).toEqual({
      sessions: [{ sessionId: second, name: "docs", status: SessionStatuses.running }],
    });
    expect(glue.watches).toEqual([[second]]);
  });

  it("marks a closed session closed and hides it from the status line", async () => {
    const glue = await started(local(migrate), {
      list: Success.make({ result: [migrate] }),
      close: Success.make({ result: null }),
    });

    await glue.call("close", { sessionId: first });

    expect(glue.states.at(-1)).toEqual({
      sessions: [{ ...migrate, status: SessionStatuses.closed }],
    });
    expect(glue.statusLines.at(-1)).toBeUndefined();
    expect(glue.stoppedWatches).toEqual([[first]]);
  });

  it("marks a closed session open when a prompt reopens it and restarts the watch with it", async () => {
    const closed = ref({ ...migrate, status: SessionStatuses.closed });

    const glue = await started(local(closed), {
      list: Success.make({ result: [closed] }),
      prompt: Success.make({ result: null }),
    });

    expect(glue.watches).toEqual([]);

    await glue.call("prompt", { sessionId: first, text: "one more thing", mode: "followUp" });

    expect(glue.states.at(-1)).toEqual({
      sessions: [{ ...migrate, status: SessionStatuses.running }],
    });
    expect(glue.watches).toEqual([[first]]);
  });

  it("drops a session a tool call finds missing and fails the tool with SessionNotFound", async () => {
    const glue = await started(local(migrate), {
      list: Success.make({ result: [migrate] }),
      messages: Failure.make({ error: new SessionNotFound({ sessionId: first }) }),
    });

    const outcome = await glue.call("messages", { sessionId: first });

    expect(outcome).toEqual({ isError: true, text: expect.stringContaining("SessionNotFound") });
    expect(glue.states.at(-1)).toEqual({ sessions: [] });
  });

  it("drops a session the watch reports missing", async () => {
    const glue = await started(local(migrate), { list: Success.make({ result: [migrate] }) });

    glue.emit({ sessionId: first, error: new SessionNotFound({ sessionId: first }) });

    expect(glue.states.at(-1)).toEqual({ sessions: [] });
    expect(glue.statusLines.at(-1)).toBeUndefined();
  });
});

const watching = () => started(local(migrate), { list: Success.make({ result: [migrate] }) });

describe("parent controller on a watch line", () => {
  it("wakes the parent with the session, the question id and its text, and updates the status line", async () => {
    const glue = await watching();

    glue.emit({
      sessionId: first,
      state: Waiting.make({ question: questionOf("q-7", "Which branch?") }),
    });

    expect(glue.wakes).toHaveLength(1);
    expect(glue.wakes[0]).toContain(first);
    expect(glue.wakes[0]).toContain("q-7");
    expect(glue.wakes[0]).toContain("Which branch?");
    expect(glue.statusLines.at(-1)).toBe("migrate: waiting");
  });

  it("wakes the parent with the last message when a run finishes", async () => {
    const glue = await watching();

    glue.emit({
      sessionId: first,
      state: Idle.make({ lastEntry: TextEntry.make({ text: "Opened PR 12." }) }),
    });

    expect(glue.wakes).toEqual([expect.stringContaining("Opened PR 12.")]);
    expect(glue.wakes[0]).toContain(first);
  });

  it("wakes the parent with the failure when a run fails", async () => {
    const glue = await watching();

    glue.emit({
      sessionId: first,
      state: Failed.make({ failure: "The workspace did not start." }),
    });

    expect(glue.wakes).toEqual([expect.stringContaining("The workspace did not start.")]);
  });

  it("updates the status line without a wake while a session runs", async () => {
    const glue = await started(local(ref({ ...migrate, status: SessionStatuses.idle })), {
      list: Success.make({ result: [ref({ ...migrate, status: SessionStatuses.idle })] }),
    });

    glue.emit({ sessionId: first, state: Running.make({}) });
    await settle();

    expect(glue.statusLines.at(-1)).toBe("migrate: running");
    expect(glue.wakes).toEqual([]);
  });
});
