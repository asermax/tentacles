import { env } from "cloudflare:workers";

import { claudeObjectName } from "../src/claude-names";
import type { FakeContainerSetup } from "./fake-container";

/** The one Claude object every session reaches. */
export const claudeObject = () => env.ClaudeObject.getByName(claudeObjectName);

/** A relay request body for a call from the given session, as the Claude provider sends it. */
export const streamBody = (session = crypto.randomUUID()) =>
  JSON.stringify({
    modelId: "claude-sonnet-5-5",
    context: { messages: [{ role: "user", content: "Say done.", timestamp: 0 }] },
    options: { sessionId: crypto.randomUUID() },
    sender: { session },
  });

/** A call to the Claude object, as a session object makes it. */
export const callClaude = (session?: string) =>
  claudeObject().fetch("http://claude/stream", { method: "POST", body: streamBody(session) });

/** Empties the Claude object and puts its container in the given state. */
export const resetClaude = (setup: Partial<FakeContainerSetup> = {}) =>
  claudeObject().reset({ isRunning: false, readyOnProbe: 1, answers: ["done"], ...setup });

/** The call id of the nth call the relay received. */
export const forwardedCallId = async (index: number) => {
  const callId = (await claudeObject().containerState()).relayRequests[index]?.callId;

  if (callId == null) {
    throw new Error(`The relay received no call ${index} with a call id`);
  }

  return callId;
};

/** The relay's end report for a call, as the container sends it. */
export const reportCallEnd = (callId: string) =>
  env.TENTACLES.fetch(`http://tentacles.internal/claude/calls/${callId}/end`, { method: "POST" });

/**
 * Moves the Claude object's clock forward by the idle time and runs one alarm pass, as the platform
 * would once that time had passed. Returns the signals the container has received so far.
 */
export const alarmAfterIdle = async (idleMs: number) => {
  await claudeObject().advanceTime(idleMs);
  await claudeObject().runAlarm();

  return (await claudeObject().containerState()).signals;
};

/** Aborts the Claude object; the next call to it runs on a new instance. */
export const restartClaude = () =>
  claudeObject()
    .restart()
    .catch(() => undefined);
