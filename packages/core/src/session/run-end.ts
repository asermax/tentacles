import {
  defineExtension,
  defineTask,
  GenerationTask,
  hook,
  ROOT_CONVERSATION_ID,
  runEndTask,
} from "@earendil-works/pi-durable";
import type { SessionId } from "@tentacles/worker-api/ids";
import * as Effect from "effect/Effect";

import { RecordDoc } from "./record.ts";
import { pendingWork } from "./repository.ts";

// Each commit prompt starts a run that asks the afterRun hook again; after
// this many in one run, the run ends with the work still pending.
const commitPromptCap = 3;

const commitPrompt = (status: string) =>
  "Your run finished with work in /workspace that is not committed and pushed. When the workspace " +
  `stops, that work is lost. Commit and push it now.\n\n${status}`;

/**
 * The end-of-run commit check of a root run whose session manages a
 * repository: while the repository holds pending work, it prompts the agent to
 * commit and push, at most three times per run. A failed or aborted run never
 * reaches it.
 */
export const commitCheckExtension = (sessionId: SessionId) => {
  const CommitCheck = defineTask<null, { phase: "check" }, null>({
    name: "tentacles.commit-check",
    version: 1,
    initial: () => ({ phase: "check" }),
    phases: {
      check: async (task, runtime, context) => {
        const record = await runtime.snapshot(RecordDoc, sessionId, context);
        const env = await runtime.env(context);

        const status =
          record == null || env == null || record.commitPrompts >= commitPromptCap
            ? null
            : await Effect.runPromise(pendingWork(env));

        // Fetched before the commit: reads inside it would wait for the commit itself.
        const conversation = await runtime.conversation(runtime.conversationId, context);

        await runtime.commit(async (tx) => {
          if (status != null && record != null && conversation != null) {
            await conversation.submit(tx, {
              type: "input",
              content: commitPrompt(status),
              whenBusy: "followUp",
              requestId: `commit-check:${task.id}`,
            });

            (await tx.doc(RecordDoc, sessionId, record)).commitPrompts += 1;
          }

          return { status: "terminal", outcome: { status: "completed", result: null } };
        }, context);
      },
    },
    abort: (_task, runtime, context) =>
      runtime.commit(() => ({ status: "terminal", outcome: { status: "aborted" } }), context),
  });

  return defineExtension({
    name: "tentacles-commit-check",
    tasks: [CommitCheck],
    hooks: [
      hook(GenerationTask, {
        afterRun: async (_run, api, context) => {
          if (api.conversationId !== ROOT_CONVERSATION_ID) {
            return undefined;
          }

          const record = await api.snapshot(RecordDoc, sessionId, context);

          return record?.settings.repository == null
            ? undefined
            : { tasks: [runEndTask(CommitCheck, null)] };
        },
      }),
    ],
  });
};
