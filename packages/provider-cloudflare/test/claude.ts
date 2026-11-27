import { env } from "cloudflare:workers";

import type { FakeContainerSetup } from "./fake-container";

/** The one Claude object every session reaches. */
export const claudeObject = () => env.ClaudeObject.getByName("claude");

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
