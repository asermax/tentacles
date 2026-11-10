import type { Context } from "@earendil-works/chord/context";
import type { Message } from "@earendil-works/pi-ai";
import {
  AssistantEntry,
  type ConversationId,
  configure,
  defineDoc,
  defineTask,
  defineTool,
  type EntryId,
  type Extension,
  LiveDoc,
  type LiveState,
  type TaskId,
  type ToolExecutionApi,
  type Tx,
} from "@earendil-works/pi-durable";
import { lit, obj, oneOf, str, union } from "@earendil-works/pi-schema";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { subagentReportKind, ToolNames } from "./tool-names.ts";

type Child = {
  readonly id: string;
  readonly name: string;
  readonly conversationId: ConversationId;
  /** The reporter of every message sent to the child, oldest first. */
  readonly reporters: TaskId<string | null>[];
  /** Answers already reported: several messages can end in one answer, reported once. */
  readonly reported: EntryId[];
};

// The background children of one conversation, in spawn order.
const Subagents = defineDoc<{ children: Child[] }>({
  kind: "tentacles.subagents",
  version: 1,
  scope: "conversation",
  history: "latest",
  fork: "initial",
  initial: () => ({ children: [] }),
  checkpointWhen: () => false,
});

/** What a foreground run's result carries, so the transcript tells it from the other actions. */
const ForegroundDetails = Schema.Struct({ subagentConversation: Schema.Finite });

const decodeForegroundDetails = Schema.decodeUnknownOption(ForegroundDetails);

/** Whether a subagent tool result is a foreground child's answer. */
export const isForegroundAnswer = (details: Schema.Json | undefined) =>
  Option.isSome(decodeForegroundDetails(details));

const textOf = (message: Message | undefined) =>
  message?.role === "assistant"
    ? message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("")
    : "";

const answerOf = async (tx: Pick<Tx, "entry">, answer: EntryId) =>
  textOf((await tx.entry(AssistantEntry, answer))?.model?.[0]);

const answerText = (api: Pick<ToolExecutionApi, "commit">, answer: EntryId, context: Context) =>
  api.commit((tx) => answerOf(tx, answer), context);

const childStatus = (live: Readonly<LiveState> | undefined) => {
  if (live?.run != null) {
    return "running";
  }

  if (live?.runFailure == null) {
    return "idle";
  }

  return live.runFailure.reason === "aborted" ? "stopped" : "failed";
};

// A child must outlive the call that spawned it, so a background task owns its
// conversation: the parent's abort and idle waits stop at it.
const Anchor = defineTask<null, { phase: "done" }, null>({
  name: "tentacles.subagent-anchor",
  version: 1,
  initial: () => ({ phase: "done" }),
  phases: {
    done: (_anchor, runtime, context) =>
      runtime.commit(
        () => ({ status: "terminal", outcome: { status: "completed", result: null } }),
        context,
      ),
  },
  abort: (_anchor, runtime, context) =>
    runtime.commit(() => ({ status: "terminal", outcome: { status: "aborted" } }), context),
});

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
const Reporter = defineTask<ReporterInput, ReporterState, string | null>({
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

/** The tasks the subagent tool creates; installed with it so they resume after a restart. */
export const subagentTasks = [Anchor, Reporter];

const reply = (text: string) => ({ output: [{ type: "text" as const, text }] });

const findChild = (children: readonly Child[], id: string) => {
  const child = children.find((each) => each.id === id);

  if (child == null) {
    throw new Error(`No subagent with id ${id}. Use the list action to see them.`);
  }

  return child;
};

/**
 * The subagent tool: run waits for a foreground child's answer (pi-durable's
 * example 21); spawn, message, wait, stop and list manage background children
 * (example 22). Children start as a copy of this conversation's agent without
 * `withheld`, the extension holding this tool and the question tool, so they
 * neither nest nor ask the parent.
 */
export const subagentTool = (withheld: () => Extension) =>
  defineTool({
    name: ToolNames.subagent,
    description:
      "Delegate work to subagents. run: a self-contained task; waits for the answer. spawn: starts " +
      "a named background subagent and returns its id; its answers arrive later as messages to you. " +
      "message: sends a follow-up or a steer to a background subagent. wait: waits for its answer to " +
      "the last message. stop: stops its current work. list: each subagent's id, name and status.",
    parameters: union([
      obj({ action: lit("run"), task: str({ description: "A self-contained task." }) }),
      obj({
        action: lit("spawn"),
        task: str(),
        name: str({ description: "A short label for list." }),
      }),
      obj({ action: lit("message"), id: str(), text: str(), mode: oneOf(["followUp", "steer"]) }),
      obj({ action: lit("wait"), id: str() }),
      obj({ action: lit("stop"), id: str() }),
      obj({ action: lit("list") }),
    ]),
    // A call cut off by an eviction is not run again: repeating stop could stop
    // newer work. The model sees the interruption and can list.
    replay: "unsafe",
    execute: async (args, api, context) => {
      const children = (await api.snapshot(Subagents, api.conversationId, context))?.children ?? [];
      const background = { ownership: { kind: "conversation" }, background: true } as const;

      switch (args.action) {
        case "run": {
          const child = await api.commit(async (tx) => {
            const created = await tx.createConversation({
              ownership: { kind: "task", taskId: api.taskId },
            });

            await configure(tx, created.id, { extensions: { remove: [withheld()] } });

            return created.id;
          }, context);

          const handle = await api.conversation(child, context);

          const submission = await handle?.submit(
            { type: "input", content: args.task, requestId: `subagent:${api.taskId}` },
            context,
          );

          const settled = await submission?.wait(context);

          if (settled?.status !== "done" || settled.type !== "input") {
            throw new Error(`The subagent did not answer: ${settled?.status ?? "no conversation"}`);
          }

          return {
            ...reply(await answerText(api, settled.answer, context)),
            details: { subagentConversation: child },
          };
        }

        case "spawn": {
          const id = await api.commit(async (tx) => {
            const anchor = await tx.createTask(Anchor, null, background);

            const created = await tx.createConversation({
              ownership: { kind: "task", taskId: anchor },
            });

            await configure(tx, created.id, {
              extensions: { remove: [withheld()] },
              instructions: `You are the subagent "${args.name}". Answer the requests of the agent that started you.`,
            });

            const reporter = await tx.createTask(
              Reporter,
              { name: args.name, conversationId: created.id, message: args.task, followUp: true },
              background,
            );

            (await tx.doc(Subagents, api.conversationId)).children.push({
              id: String(created.id),
              name: args.name,
              conversationId: created.id,
              reporters: [reporter],
              reported: [],
            });

            return String(created.id);
          }, context);

          return reply(`Started subagent ${args.name} with id ${id}.`);
        }

        case "message": {
          const child = findChild(children, args.id);

          await api.commit(async (tx) => {
            const reporter = await tx.createTask(
              Reporter,
              {
                name: child.name,
                conversationId: child.conversationId,
                message: args.text,
                followUp: args.mode === "followUp",
              },
              background,
            );

            findChild(
              (await tx.doc(Subagents, api.conversationId)).children,
              args.id,
            ).reporters.push(reporter);
          }, context);

          return reply(`Sent to ${child.name}.`);
        }

        case "wait": {
          const last = findChild(children, args.id).reporters.at(-1);
          const settled = last == null ? null : await api.waitForTask(last, context);

          const answer =
            settled?.state.outcome.status === "completed" ? settled.state.outcome.result : null;

          return reply(answer ?? "The subagent gave no answer to its last message.");
        }

        case "stop": {
          const child = findChild(children, args.id);

          await (await api.conversation(child.conversationId, context))?.abort(context);

          return reply(`Stopped ${child.name}.`);
        }

        case "list": {
          const lines = await Promise.all(
            children.map(async (child) => {
              const live = await api.snapshot(LiveDoc, child.conversationId, context);

              return `${child.id} ${child.name} ${childStatus(live)}`;
            }),
          );

          return reply(lines.length === 0 ? "No subagents." : lines.join("\n"));
        }

        default: {
          const exhaustive: never = args;

          return exhaustive;
        }
      }
    },
  });
