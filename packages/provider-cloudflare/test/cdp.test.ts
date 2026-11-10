import { describe, expect, it } from "@effect/vitest";
import { env } from "cloudflare:workers";

describe("the CDP relay", () => {
  it("refuses a token whose signature the Worker did not make", async () => {
    const forged = `browser-session.${btoa("not the signature").replaceAll("=", "")}`;

    const response = await env.TENTACLES.fetch(`https://tentacles.asermax.com/cdp/${forged}`, {
      headers: { upgrade: "websocket" },
    });

    expect(response.status).toBe(404);
    expect(response.webSocket).toBeNull();
  });

  it("refuses a token with no signature", async () => {
    const response = await env.TENTACLES.fetch(
      "https://tentacles.asermax.com/cdp/browser-session",
      { headers: { upgrade: "websocket" } },
    );

    expect(response.status).toBe(404);
  });
});
