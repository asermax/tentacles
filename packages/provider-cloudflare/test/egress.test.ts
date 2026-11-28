import { describe, expect, it } from "@effect/vitest";
import { env } from "cloudflare:workers";
import { beforeEach } from "vitest";
import * as Schema from "effect/Schema";

import {
  alarmAfterIdle,
  callClaude,
  claudeObject,
  forwardedCallId,
  reportCallEnd,
  resetClaude,
} from "./claude";
import { Forwarded } from "./echo";
import { testSecrets } from "./secrets";

const sigterm = 15;

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

describe("the Claude container's end report", () => {
  beforeEach(async () => {
    await resetClaude({ isRunning: true, answers: ["open"] });
  });

  it("takes a call in flight off the Claude object's count and moves its last activity", async () => {
    await callClaude();

    const callId = await forwardedCallId(0);

    await claudeObject().advanceTime(14 * 60_000);

    const response = await reportCallEnd(callId);

    expect(response.status).toBe(204);

    // Idle for 14 minutes since the end report, though 28 since the call began.
    expect(await alarmAfterIdle(14 * 60_000)).toEqual([]);
    expect(await alarmAfterIdle(2 * 60_000)).toEqual([sigterm]);
  });

  it("changes nothing for a call the Claude object no longer holds", async () => {
    await callClaude();

    const callId = await forwardedCallId(0);
    const unknownCallResponse = await reportCallEnd(crypto.randomUUID());

    expect(unknownCallResponse.status).toBe(204);

    // The call in flight stays counted.
    expect(await alarmAfterIdle(20 * 60_000)).toEqual([]);

    await reportCallEnd(callId);
    await claudeObject().advanceTime(14 * 60_000);

    expect((await reportCallEnd(crypto.randomUUID())).status).toBe(204);

    // The report of the unknown call did not move the last activity.
    expect(await alarmAfterIdle(2 * 60_000)).toEqual([sigterm]);
  });

  it("answers 404 to an end report whose id is not a call id", async () => {
    expect((await reportCallEnd("not-a-call-id")).status).toBe(404);
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
  });
});
