import type { Context } from "@earendil-works/chord/context";
import type { EntryId, ToolExecutionApi } from "@earendil-works/pi-durable";

import { answerOf } from "./answer-of.ts";

export const answerText = (
  api: Pick<ToolExecutionApi, "commit">,
  answer: EntryId,
  context: Context,
) => api.commit((tx) => answerOf(tx, answer), context);
