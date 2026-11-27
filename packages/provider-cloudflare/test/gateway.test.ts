import { describe, expect, it } from "@effect/vitest";
import { env } from "cloudflare:workers";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import { signToken } from "../src/browser";
import { Forwarded } from "./echo";
import { testSecrets } from "./secrets";

const arbitraryCredential = "an-authorization-the-gateway-replaces";

const decodeForwarded = Schema.decodeUnknownSync(Forwarded);

const fetchCdp = (token: string) =>
  env.GATEWAY.fetch(`http://tentacles.asermax.com/cdp/${token}`, {
    headers: { upgrade: "websocket" },
  });

describe("the workspace container's gateway", () => {
  it("adds the GitHub token to a request to github.com, replacing any authorization it carries", async () => {
    const gatewayResponse = await env.GATEWAY.fetch(
      "https://github.com/owner/repository.git/info/refs?service=git-upload-pack",
      { headers: { authorization: `Basic ${btoa(`x-access-token:${arbitraryCredential}`)}` } },
    );

    const forwarded = decodeForwarded(await gatewayResponse.json());

    expect(forwarded.url).toBe(
      "https://github.com/owner/repository.git/info/refs?service=git-upload-pack",
    );
    expect(forwarded.headers.authorization).toBe(
      `Basic ${btoa(`x-access-token:${testSecrets.TENTACLES_GITHUB_TOKEN}`)}`,
    );
  });

  it("adds no token to a plain HTTP request to github.com", async () => {
    const gatewayResponse = await env.GATEWAY.fetch(
      "http://github.com/owner/repository.git/info/refs",
    );

    const forwarded = decodeForwarded(await gatewayResponse.json());

    expect(forwarded.url).toBe("http://github.com/owner/repository.git/info/refs");
    expect(forwarded.headers.authorization).toBeUndefined();
  });

  it("passes a request to any other host through unchanged", async () => {
    const gatewayResponse = await env.GATEWAY.fetch("https://example.com/somewhere?q=1", {
      headers: { "x-probe": "kept" },
    });

    const forwarded = decodeForwarded(await gatewayResponse.json());

    expect(forwarded.url).toBe("https://example.com/somewhere?q=1");
    expect(forwarded.headers["x-probe"]).toBe("kept");
    expect(forwarded.headers.authorization).toBeUndefined();
  });

  it("connects a signed CDP token to the browser session it names", async () => {
    const token = await signToken(Redacted.make(testSecrets.TENTACLES_CDP_SECRET), "browser-7");

    await fetchCdp(token);

    expect(await env.BROWSER_STUB.connectedSessions()).toContain("browser-7");
  });

  it("refuses a token whose signature the Worker did not make", async () => {
    const forged = `browser-forged.${btoa("not the signature").replaceAll("=", "")}`;

    const cdpResponse = await fetchCdp(forged);

    expect(cdpResponse.status).toBe(404);
    expect(cdpResponse.webSocket).toBeNull();
    expect(await env.BROWSER_STUB.connectedSessions()).not.toContain("browser-forged");
  });

  it("refuses a token with no signature", async () => {
    const cdpResponse = await fetchCdp("browser-session");

    expect(cdpResponse.status).toBe(404);
  });
});
