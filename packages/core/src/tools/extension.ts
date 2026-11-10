import { defineExtension, type Extension } from "@earendil-works/pi-durable";
import { CodingTools } from "@earendil-works/pi-durable/tools";
import type { SessionId } from "@tentacles/worker-api/ids";
import * as Effect from "effect/Effect";

import { askParentTool } from "./question.ts";

/** The extensions a session's harness installs: the remote agent's tools and instructions. */
export const remoteAgentExtensions = (sessionId: SessionId) =>
  Effect.succeed<readonly Extension[]>([
    CodingTools,
    defineExtension({ name: "tentacles", tools: [askParentTool(sessionId)] }),
  ]);
