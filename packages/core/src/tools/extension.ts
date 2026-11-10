import { defineExtension, type Extension } from "@earendil-works/pi-durable";
import { CodingTools } from "@earendil-works/pi-durable/tools";
import type { Browser } from "@tentacles/contracts/browser";
import type { PreviewRouter } from "@tentacles/contracts/preview-router";
import type { RegistryStore } from "@tentacles/contracts/registry-store";
import type { SessionId } from "@tentacles/worker-api/ids";
import * as Effect from "effect/Effect";

import { commitCheckExtension } from "../session/run-end.ts";
import { previewTool } from "./preview.ts";
import { askParentTool } from "./question.ts";

/** The extensions a session's harness installs: the remote agent's tools and instructions. */
export const remoteAgentExtensions = (sessionId: SessionId) =>
  Effect.gen(function* () {
    const run = Effect.runPromiseWith(
      yield* Effect.context<Browser | PreviewRouter | RegistryStore>(),
    );

    return [
      CodingTools,
      commitCheckExtension(sessionId),
      defineExtension({
        name: "tentacles",
        tools: [askParentTool(sessionId), previewTool(sessionId, run)],
      }),
    ] satisfies readonly Extension[];
  });
