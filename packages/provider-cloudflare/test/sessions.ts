import { Parent } from "@tentacles/worker-api/parent";
import { SessionState, SessionStatuses } from "@tentacles/worker-api/session-state";
import type { Repository } from "@tentacles/worker-api/settings";
import { env } from "cloudflare:workers";
import * as Schema from "effect/Schema";

import { testSecrets } from "./secrets.ts";

const api = "https://tentacles.asermax.com/api";

const headers = { authorization: `Bearer ${testSecrets.TENTACLES_API_KEY}` };

const parent = Schema.decodeSync(Parent)({ harness: "pi", sessionId: "parent-session" });

/** A call to the Worker API with the key. */
const apiFetch = (path: string) => env.TENTACLES.fetch(`${api}${path}`, { headers });

const statusOf = async (sessionId: string) => {
  const response = await apiFetch(`/sessions/${sessionId}/status`);

  return Schema.decodeUnknownSync(SessionState)(await response.json());
};

const isIdle = Schema.is(Schema.TaggedStruct(SessionStatuses.idle, {}));

/**
 * Creates a session under a known id through its object, as the Worker's SessionHost does, and
 * waits until its first run has finished; the test model answers at once.
 */
export const idleSession = async (sessionId: string, repository: Repository | null = null) => {
  await env.SessionObject.getByName(sessionId).create({
    name: "worker",
    parent,
    prompt: "Say done.",
    settings: {
      provider: "cloudflare",
      model: "glm-5.2",
      effort: "max",
      image: "default",
      size: "basic",
      lifetime: 15,
      repository,
    },
  });

  for (let attempt = 0; attempt < 50; attempt++) {
    if (isIdle(await statusOf(sessionId))) {
      return;
    }

    await scheduler.wait(100);
  }

  throw new Error(`Session ${sessionId} never went idle`);
};
