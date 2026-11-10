import { describe, expect, it } from "@effect/vitest";
import { env } from "cloudflare:workers";

describe("the daily cron", () => {
  it("runs core's cleanup inside the firing event", async () => {
    const result = await env.TENTACLES.scheduled({ cron: "0 4 * * *", scheduledTime: new Date() });

    expect(result.outcome).toBe("ok");
  });
});
