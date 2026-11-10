import { describe, expect, it } from "@effect/vitest";
import { env } from "cloudflare:workers";

import { testSecrets } from "./secrets.ts";

const api = "https://tentacles.asermax.com/api/sessions?harness=pi&sessionId=parent";

describe("the API behind the key", () => {
  it("answers 401 to a request without the key", async () => {
    const response = await env.TENTACLES.fetch(api);

    expect(response.status).toBe(401);
  });

  it("answers 401 to a request with a wrong key", async () => {
    const response = await env.TENTACLES.fetch(api, {
      headers: { authorization: "Bearer not-the-key" },
    });

    expect(response.status).toBe(401);
  });

  it("passes a request with the key to core's handlers", async () => {
    const response = await env.TENTACLES.fetch(api, {
      headers: { authorization: `Bearer ${testSecrets.TENTACLES_API_KEY}` },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
});

describe("hosts that are neither a route nor the API", () => {
  it("answers 404 to a preview host whose name is not a token", async () => {
    const response = await env.TENTACLES.fetch("https://not-a-uuid-tentacles-preview.asermax.com/");

    expect(response.status).toBe(404);
  });

  it("answers 404 to another host and path without reaching an egress handler", async () => {
    const response = await env.TENTACLES.fetch("https://example.com/somewhere");

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });
});
