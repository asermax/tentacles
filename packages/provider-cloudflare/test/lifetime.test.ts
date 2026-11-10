import { describe, expect, it } from "@effect/vitest";
import { env } from "cloudflare:workers";

import { lifetimeSessionId } from "./secrets.ts";
import { idleSession } from "./sessions.ts";

const ping = (pendingWork: boolean) =>
  env.LIFETIME.fetch(`http://tentacles.internal/lifetime?pendingWork=${pendingWork}`);

describe("the workspace's lifetime ping", () => {
  it("reaches the session named in the props, which keeps a workspace with pending work", async () => {
    await idleSession(lifetimeSessionId);

    const withPendingWork = await ping(true);
    const withoutPendingWork = await ping(false);

    expect(await withPendingWork.text()).toBe("yes");
    expect(await withoutPendingWork.text()).toBe("no");
  });
});
