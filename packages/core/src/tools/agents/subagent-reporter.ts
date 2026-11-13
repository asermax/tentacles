import { type ConversationId, defineTask } from "@earendil-works/pi-durable";

import { subagentReportKind } from "../tool-names";
import { answerOf } from "./answer-of";
import { Subagents } from "./subagents-doc";

type ReporterInput = {
  readonly name: string;
  readonly conversationId: ConversationId;
  readonly message: string;
  readonly followUp: boolean;
};

type ReporterState =
  | { readonly phase: "deliver" }
  | { readonly phase: "report"; readonly report: string | null; readonly answer: string | null };

const toReport = (report: string | null, answer: string | null) =>
  ({ status: "running", checkpoint: { phase: "report", report, answer } }) as const;

// Delivers one message to a child and posts its answer to the parent as a
// follow-up input; request ids keep a restart from sending either twice. Its
// result is the answer, which wait returns.
export const Reporter = defineTask<ReporterInput, ReporterState, string | null>({
  name: "tentacles.subagent-reporter",
  version: 1,
  initial: () => ({ phase: "deliver" }),
  phases: {
    deliver: async (reporter, runtime, context) => {
      const { name, conversationId, message, followUp } = reporter.input;
      const child = await runtime.conversation(conversationId, context);

      if (child == null) {
        throw new Error(`The subagent ${name} has no conversation`);
      }

      const submission = await child.submit(
        {
          type: "input",
          content: message,
          whenBusy: followUp ? "followUp" : "steer",
          requestId: `subagent:${reporter.id}`,
        },
        context,
      );

      const settled = await submission.wait(context);

      await runtime.commit(async (tx) => {
        if (settled.status === "unanswered") {
          return toReport(
            settled.reason === "aborted" ? null : `[subagent ${name} failed: ${settled.reason}]`,
            null,
          );
        }

        if (settled.type !== "input") {
          return toReport(null, null);
        }

        const answer = await answerOf(tx, settled.answer);

        const state = await tx.doc(Subagents, runtime.conversationId);
        const known = state.children.find((each) => each.conversationId === conversationId);

        if (known == null || known.reported.includes(settled.answer)) {
          return toReport(null, answer);
        }

        known.reported.push(settled.answer);

        return toReport(`[subagent ${name} answered] ${answer}`, answer);
      }, context);
    },
    report: async (reporter, runtime, context) => {
      const { report, answer } = reporter.state.checkpoint;

      if (report != null) {
        const parent = await runtime.conversation(runtime.conversationId, context);

        await parent?.submit(
          {
            type: "input",
            content: report,
            whenBusy: "followUp",
            requestId: `subagent-report:${reporter.id}`,
            entry: { kind: subagentReportKind, data: { name: reporter.input.name, text: report } },
          },
          context,
        );
      }

      await runtime.commit(
        () => ({ status: "terminal", outcome: { status: "completed", result: answer } }),
        context,
      );
    },
  },
  abort: (_reporter, runtime, context) =>
    runtime.commit(() => ({ status: "terminal", outcome: { status: "aborted" } }), context),
});
