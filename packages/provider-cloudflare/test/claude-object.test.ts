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

  it("starts the container once for two calls that arrive during the start", async () => {
    await resetClaude({ readyOnProbe: 3 });

    const responses = await Promise.all([callClaude(), callClaude()]);
    const { starts, relayRequests } = await claudeObject().containerState();

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(starts).toHaveLength(1);
    expect(relayRequests.map((request) => request.probesAnswered)).toEqual([3, 3]);
  });
});
