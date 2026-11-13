import {
  type ConversationId,
  configure,
  defineTool,
  type Extension,
  LiveDoc,
} from "@earendil-works/pi-durable";
import { lit, obj, oneOf, str, union } from "@earendil-works/pi-schema";

import { ToolNames } from "../tool-names.ts";
import { agentArgument } from "./agent-argument.ts";
import { agentNamed } from "./agent-named.ts";
import { answerText } from "./answer-text.ts";
import { childStatus } from "./child-status.ts";
import { findChild } from "./find-child.ts";
import { reply } from "./reply.ts";
import { Anchor } from "./subagent-anchor.ts";
import { Reporter } from "./subagent-reporter.ts";
import { Subagents } from "./subagents-doc.ts";

/**
 * The subagent tool: run waits for a foreground child's answer (pi-durable's
 * example 21); spawn, message, wait, stop and list manage background children
 * (example 22). Children start as a copy of this conversation's agent without
 * the extensions `withheld` names for this conversation, so a child never asks
 * the parent and a grandchild cannot start subagents. A child starts with the
 * instructions of the agent the call names, or with none of its owner's.
 */
export const subagentTool = (withheld: (caller: ConversationId) => readonly Extension[]) =>
  defineTool({
    name: ToolNames.subagent,
    description:
      "Delegate work to subagents. run: a self-contained task; waits for the answer. spawn: starts " +
      "a named background subagent and returns its id; its answers arrive later as messages to you. " +
      "message: sends a follow-up or a steer to a background subagent. wait: waits for its answer to " +
      "the last message. stop: stops its current work. list: each subagent's id, name and status.",
    parameters: union([
      obj({
        action: lit("run"),
        task: str({ description: "A self-contained task." }),
        agent: agentArgument,
      }),
      obj({
        action: lit("spawn"),
        task: str(),
        name: str({ description: "A short label for list." }),
        agent: agentArgument,
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
          const agent = await agentNamed(args.agent, api, context);

          const child = await api.commit(async (tx) => {
            const created = await tx.createConversation({
              ownership: { kind: "task", taskId: api.taskId },
            });

            await configure(tx, created.id, {
              extensions: { remove: withheld(api.conversationId) },
              instructions: agent?.prompt ?? null,
            });

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
          const agent = await agentNamed(args.agent, api, context);

          const id = await api.commit(async (tx) => {
            const anchor = await tx.createTask(Anchor, null, background);

            const created = await tx.createConversation({
              ownership: { kind: "task", taskId: anchor },
            });

            await configure(tx, created.id, {
              extensions: { remove: withheld(api.conversationId) },
              instructions:
                agent?.prompt ??
                `You are the subagent "${args.name}". Answer the requests of the agent that started you.`,
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
