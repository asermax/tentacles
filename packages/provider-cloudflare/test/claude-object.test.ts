import { describe, expect, it } from "@effect/vitest";
import { beforeEach } from "vitest";

import { callClaude, claudeObject, resetClaude } from "./claude";

describe("the Claude object's calls", () => {
  beforeEach(async () => {
    await resetClaude();
  });

  it("waits for the relay's start before it forwards the first call", async () => {
    await resetClaude({ readyOnProbe: 3 });

    const response = await callClaude();
    const { starts, relayRequests } = await claudeObject().containerState();

    expect(response.status).toBe(200);
    expect(starts).toHaveLength(1);
    expect(relayRequests.map((request) => request.probesAnswered)).toEqual([3]);
  });

  it("starts the container once and forwards and counts both of two calls that arrive during the start", async () => {
    await resetClaude({ readyOnProbe: 3 });

    const responses = await Promise.all([callClaude(), callClaude()]);
    const { starts, relayRequests } = await claudeObject().containerState();
    const { callIds } = await claudeObject().storedCalls();

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(starts).toHaveLength(1);
    expect(relayRequests.map((request) => request.probesAnswered)).toEqual([3, 3]);

    const forwardedIds = relayRequests.map((request) => request.callId);

    expect(new Set(forwardedIds).size).toBe(2);
    expect(new Set(callIds)).toEqual(new Set(forwardedIds));
  });

  it("forwards a call to a running container with its call id and counts it", async () => {
    await resetClaude({ isRunning: true });

    const response = await callClaude();
    const { starts, relayRequests } = await claudeObject().containerState();
    const { callIds, lastActivity } = await claudeObject().storedCalls();

    expect(response.status).toBe(200);
    expect(starts).toHaveLength(0);
    expect(relayRequests).toHaveLength(1);
    expect(callIds).toEqual([relayRequests[0]?.callId]);
    expect(lastActivity).not.toBeNull();
  });

  it("takes a call off the count when it cannot reach the relay", async () => {
    await resetClaude({ isRunning: true, answers: ["unreachable"] });

    const response = await callClaude().catch(() => null);
    const { callIds } = await claudeObject().storedCalls();

    expect(response?.status).not.toBe(200);
    expect(callIds).toEqual([]);
  });
});
