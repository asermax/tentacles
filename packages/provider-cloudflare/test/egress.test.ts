import { describe, expect, it } from "@effect/vitest";
import { env } from "cloudflare:workers";
import { beforeEach } from "vitest";
import * as Schema from "effect/Schema";

import { callClaude, claudeObject, resetClaude } from "./claude";
import { Forwarded } from "./echo";
import { testSecrets } from "./secrets";

// What the Claude image sends in place of a credential; the egress replaces whatever arrives.
const placeholder = "tentacles-egress-credential";

describe("the Claude container's egress", () => {
  it("forwards a request to api.anthropic.com with the subscription token", async () => {
    const response = await env.TENTACLES.fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { authorization: `Bearer ${placeholder}` },
      body: "{}",
    });

    const forwarded = Schema.decodeUnknownSync(Forwarded)(await response.json());

    expect(forwarded.url).toBe("https://api.anthropic.com/v1/messages");
    expect(forwarded.headers.authorization).toBe(`Bearer ${testSecrets.TENTACLES_CLAUDE_TOKEN}`);
  });
});

const endReport = (callId: string) =>
  env.TENTACLES.fetch(`http://tentacles.internal/claude/calls/${callId}/end`, { method: "POST" });

describe("the Claude container's end report", () => {
  beforeEach(async () => {
    await resetClaude({ isRunning: true });
  });

  it("takes a counted call off the Claude object's count and moves its last activity", async () => {
    await callClaude();

    const callId = (await claudeObject().containerState()).relayRequests[0]?.callId ?? "";

    await claudeObject().storeLastActivity(60_000);

    const response = await endReport(callId);
    const { callIds, lastActivity } = await claudeObject().storedCalls();

    expect(response.status).toBe(204);
    expect(callIds).toEqual([]);
    expect(lastActivity).toBeGreaterThan(Date.now() - 30_000);
  });

  it("changes nothing for a call the Claude object no longer holds", async () => {
    await claudeObject().storeCall(crypto.randomUUID());
    await claudeObject().storeLastActivity(60_000);

    const before = await claudeObject().storedCalls();
    const response = await endReport(crypto.randomUUID());

    expect(response.status).toBe(204);
    expect(await claudeObject().storedCalls()).toEqual(before);
  });

  it("answers 404 to an end report whose id is not a call id", async () => {
    expect((await endReport("not-a-call-id")).status).toBe(404);
  });

  it("answers 404 to another path on the internal host", async () => {
    const response = await env.TENTACLES.fetch("http://tentacles.internal/lifetime", {
      method: "POST",
    });

    expect(response.status).toBe(404);
  });

  it("answers not found to a request to a host that is not an egress host", async () => {
    const response = await env.TENTACLES.fetch("https://example.com/claude/calls/x/end", {
      method: "POST",
    });

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });
});
