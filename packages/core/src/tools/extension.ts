import {
  type ConversationId,
  defineExtension,
  type Extension,
  ROOT_CONVERSATION_ID,
  section,
} from "@earendil-works/pi-durable";
import { createCodemodeExtension } from "@earendil-works/pi-durable/codemode";
import { CodingTools } from "@earendil-works/pi-durable/tools";
import type { Browser } from "@tentacles/contracts/browser";
import { CodeSandbox } from "@tentacles/contracts/code-sandbox";
import type { PreviewRouter } from "@tentacles/contracts/preview-router";
import type { RegistryStore } from "@tentacles/contracts/registry-store";
import { Workspace } from "@tentacles/contracts/workspace";
import type { SessionId } from "@tentacles/worker-api/ids";
import * as Effect from "effect/Effect";

import { commitCheckExtension } from "../session/run-end";
import { agentsExtension } from "./agents";
import { contextExtension } from "./context";
import { previewTool } from "./preview";
import { askParentTool } from "./question";
import { remoteAgentInstructions } from "./remote-agent-instructions";
import { skillsExtension } from "./skills";

/**
 * The extensions a session's harness installs: pi-durable's coding tools and
 * codemode, the commit check, the preview tool, the skills, the context and the agents, and
 * the root agent's own extension with the question tool and its instructions,
 * which subagents start without. A subagent also goes without the agents
 * extension when the conversation that starts it is not the root, so
 * subagents nest one level.
 */
export const remoteAgentExtensions = (sessionId: SessionId) =>
  Effect.gen(function* () {
    const run = Effect.runPromiseWith(
      yield* Effect.context<Browser | PreviewRouter | RegistryStore>(),
    );

    const sandbox = yield* (yield* CodeSandbox).sandbox();
    const workspace = yield* Workspace;

    const rootAgent: Extension = defineExtension({
      name: "tentacles-root-agent",
      tools: [askParentTool(sessionId)],
      sections: [section("tentacles", () => remoteAgentInstructions, { tag: false })],
    });

    const withheld = (caller: ConversationId) =>
      caller === ROOT_CONVERSATION_ID ? [rootAgent] : [rootAgent, agents];

    const agents: Extension = agentsExtension(withheld);

    return [
      CodingTools,
      createCodemodeExtension({ sandbox }),
      commitCheckExtension(sessionId, workspace.isRunning()),
      defineExtension({ name: "tentacles", tools: [previewTool(sessionId, run)] }),
      skillsExtension,
      contextExtension,
      agents,
      rootAgent,
    ] satisfies readonly Extension[];
  });
