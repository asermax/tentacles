import { ParentSessionId } from "@tentacles/worker-api/ids";
import { Harnesses, type Parent } from "@tentacles/worker-api/parent";
import type { SessionDetails } from "@tentacles/worker-api/session-state";
import type { CreateSession } from "@tentacles/worker-api/sessions";
import type { Repository, Settings } from "@tentacles/worker-api/settings";
import * as Schema from "effect/Schema";

export const parent: Parent = {
  harness: Harnesses.pi,
  sessionId: Schema.decodeSync(ParentSessionId)("parent-session"),
};

/** Settings on the faux model, which pi-ai registers as provider "faux". */
export const settings = (repository: Repository | null = null): Settings => ({
  provider: "faux",
  model: "faux-1",
  effort: "off",
  image: "default",
  size: "basic",
  lifetime: 15,
  repository,
});

export type Archives = Pick<CreateSession, "skills" | "agents">;

export const createRequest = (
  prompt: string,
  repository: Repository | null = null,
  archives: Archives = {},
): CreateSession => ({
  name: "worker",
  parent,
  settings: settings(repository),
  prompt,
  ...archives,
});

/** The details a session reports for a request, given the names its archives hold. */
export const detailsOf = (
  request: CreateSession,
  names: Partial<Pick<SessionDetails, "skills" | "agents">> = {},
): SessionDetails => ({
  settings: request.settings,
  skills: names.skills ?? [],
  agents: names.agents ?? [],
});

export const details = detailsOf(createRequest(""));
