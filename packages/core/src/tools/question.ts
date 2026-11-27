import type { Context } from "@earendil-works/chord/context";
import { defineTool, type ToolExecutionApi } from "@earendil-works/pi-durable";
import { obj, str } from "@earendil-works/pi-schema";
import { QuestionId } from "@tentacles/worker-api/ids";
import * as Schema from "effect/Schema";

import { QuestionsDoc, type StoredQuestion } from "../session/questions";
import { ToolNames } from "./tool-names";

const decodeQuestionId = Schema.decodeSync(QuestionId);

const findQuestion = (questions: readonly StoredQuestion[], id: QuestionId) =>
  questions.find((question) => question.id === id);

// Resolves with the answer once the question document holds one. The watch
// ends with the harness or the call's abort, and so does the wait.
const answerOf = async (api: ToolExecutionApi, id: QuestionId, context: Context) => {
  const watch = await api.watchDoc(QuestionsDoc, context);

  if (watch == null) {
    throw new Error("The session has no question document");
  }

  return new Promise<string>((resolve, reject) => {
    const settle = (questions: readonly StoredQuestion[]) => {
      const answer = findQuestion(questions, id)?.answer;

      if (answer != null) {
        resolve(answer);
        void watch.stop();
      }
    };

    settle(watch.value.questions);
    watch.start(async (call) => {
      if (call.kind === "value") {
        settle(call.value.questions);
      }
    });
    void watch.closed.then((end) =>
      reject(new Error(`Stopped waiting for the answer: ${end.kind}`)),
    );
  });
};

/**
 * ask_parent: stores the question under the call's task id, so a rerun after
 * an eviction finds it, and waits for the parent's answer.
 */
export const askParentTool = () =>
  defineTool({
    name: ToolNames.askParent,
    description:
      "Ask the agent that started you a question and wait for its answer. Use it when you need a " +
      "decision you cannot make yourself.",
    parameters: obj({
      question: str({
        description: "The question, written for someone who has not seen this conversation.",
      }),
    }),
    // A script's call runs as a nested task, which the session's status does
    // not read: the session would never show waiting nor wake the parent.
    callers: ["model"],
    replay: "safe",
    execute: async (args, api, context) => {
      const id = decodeQuestionId(String(api.taskId));
      const stored = await api.snapshot(QuestionsDoc, context);

      if (findQuestion(stored?.questions ?? [], id) == null) {
        await api.commit(async (tx) => {
          const draft = await tx.doc(QuestionsDoc);

          if (findQuestion(draft.questions, id) == null) {
            draft.questions.push({ id, text: args.question, answer: null });
          }
        }, context);
      }

      return { output: [{ type: "text" as const, text: await answerOf(api, id, context) }] };
    },
  });
