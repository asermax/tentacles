import { defineExtension, type Extension, section } from "@earendil-works/pi-durable";
import { createCodemodeExtension } from "@earendil-works/pi-durable/codemode";
import { CodingTools } from "@earendil-works/pi-durable/tools";
import type { Browser } from "@tentacles/contracts/browser";
import { CodeSandbox } from "@tentacles/contracts/code-sandbox";
import type { PreviewRouter } from "@tentacles/contracts/preview-router";
import type { RegistryStore } from "@tentacles/contracts/registry-store";
import type { SessionId } from "@tentacles/worker-api/ids";
import * as Effect from "effect/Effect";

import { commitCheckExtension } from "../session/run-end.ts";
import { previewTool } from "./preview.ts";
import { askParentTool } from "./question.ts";
import { remoteAgentInstructions } from "./remote-agent-instructions.ts";
import { subagentTasks, subagentTool } from "./subagent.ts";

/**
 * The extensions a session's harness installs: pi-durable's coding tools and
 * codemode, the commit check, the preview tool, and the root agent's own
 * extension with the question and subagent tools and its instructions, which
 * subagents start without.
 */
export const remoteAgentExtensions = (sessionId: SessionId) =>
  Effect.gen(function* () {
    const run = Effect.runPromiseWith(
      yield* Effect.context<Browser | PreviewRouter | RegistryStore>(),
    );

    const sandbox = yield* (yield* CodeSandbox).sandbox();

    const rootAgent: Extension = defineExtension({
      name: "tentacles-root-agent",
      tools: [askParentTool(sessionId), subagentTool(() => rootAgent)],
      tasks: subagentTasks,
      sections: [section("tentacles", () => remoteAgentInstructions, { tag: false })],
    });

    return [
      CodingTools,
      createCodemodeExtension({ sandbox }),
      commitCheckExtension(sessionId),
      defineExtension({ name: "tentacles", tools: [previewTool(sessionId, run)] }),
      rootAgent,
    ] satisfies readonly Extension[];
  });
