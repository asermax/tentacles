import { describe, expect, it } from "@effect/vitest";
import { env } from "cloudflare:workers";

import { idleSession } from "./sessions";

describe("a preview host", () => {
  it("answers 502 for a known token when nothing listens on the port", async () => {
    const sessionId = crypto.randomUUID();

    await idleSession(sessionId);

    const { token } = await env.RegistryObject.getByName("registry").openPreview(sessionId, 3000);
    const response = await env.TENTACLES.fetch(`https://${token}-tentacles-preview.asermax.com/`);

    expect(response.status).toBe(502);
    expect(await response.text()).toBe("Nothing answers on port 3000");
  });

  it("hands its token to core's preview handler, which answers 404 for an unknown token", async () => {
    const response = await env.TENTACLES.fetch(
      "https://9b2f6c1e-3d4a-4f5b-8c7d-0e1f2a3b4c5d-tentacles-preview.asermax.com/",
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("No preview here");
  });
});
