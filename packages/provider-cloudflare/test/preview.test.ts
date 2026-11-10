import { describe, expect, it } from "@effect/vitest";
import { env } from "cloudflare:workers";

describe("a preview host", () => {
  it("hands its token to core's preview handler, which answers 404 for an unknown token", async () => {
    const response = await env.TENTACLES.fetch(
      "https://9b2f6c1e-3d4a-4f5b-8c7d-0e1f2a3b4c5d-tentacles-preview.asermax.com/",
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("No preview here");
  });
});
