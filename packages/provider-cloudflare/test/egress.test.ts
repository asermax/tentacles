import { describe, expect, it } from "@effect/vitest";
import { env } from "cloudflare:workers";
import * as Schema from "effect/Schema";

import { testSecrets } from "./secrets";

// What the Claude image sends in place of a credential; the egress replaces whatever arrives.
const placeholder = "tentacles-egress-credential";

const Forwarded = Schema.Struct({
  url: Schema.String,
  headers: Schema.Record(Schema.String, Schema.String),
});

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
