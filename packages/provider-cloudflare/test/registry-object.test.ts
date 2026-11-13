import { describe, expect, it } from "@effect/vitest";
import { Parent } from "@tentacles/worker-api/parent";
import { env } from "cloudflare:workers";
import * as Schema from "effect/Schema";

const parent = Schema.decodeSync(Parent)({ harness: "pi", sessionId: "parent-session" });

const details = {
  settings: {
    provider: "anthropic",
    model: "claude-opus-5-5",
    effort: "high",
    image: "default",
    size: "standard",
    lifetime: 3600,
    repository: null,
  },
  skills: ["implement"],
  agents: ["reviewer"],
};

const sessionId = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";

describe("the registry object", () => {
  it("migrates its SQLite on its first start, then adds and lists entries", async () => {
    const registry = env.RegistryObject.getByName("registry");

    await registry.add(sessionId, "worker", parent, details);
    await registry.setStatus(sessionId, "running");

    expect(await registry.list(parent)).toEqual([
      { sessionId, name: "worker", status: "running", ...details },
    ]);
  });
});
