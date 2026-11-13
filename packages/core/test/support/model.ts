import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { FauxResponseFactory } from "@earendil-works/pi-ai/providers/faux";
import { fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";
import * as Predicate from "effect/Predicate";

/**
 * A model answer that waits until the test releases it, or until its request
 * is aborted, as a long turn would.
 */
export const heldAnswer = (text: string) => {
  const released = Promise.withResolvers<void>();

  const answer = (signal: AbortSignal | undefined) =>
    new Promise<AssistantMessage>((resolve) => {
      const respond = () => resolve(fauxAssistantMessage(text));

      void released.promise.then(respond);
      signal?.addEventListener("abort", respond, { once: true });
    });

  const response: FauxResponseFactory = (_context, options) => answer(options?.signal);

  return { response, answer, release: () => released.resolve() };
};

/** What a routed model sees of one request. */
export interface ModelRequest {
  /** The text of the newest message that is not a system message. */
  readonly last: string;
  readonly lastRole: string;
  /** The names of the tools the request offers. */
  readonly tools: ReadonlySet<string>;
  /** The prompt sections in effect, by name, after every system message of the request. */
  readonly sections: ReadonlyMap<string, string>;
  /** The instructions the system messages add, in order, joined by blank lines. */
  readonly instructions: string;
  readonly signal: AbortSignal | undefined;
}

const textOf = (
  content: string | ReadonlyArray<{ readonly type: string; readonly text?: string }>,
) => (Predicate.isString(content) ? content : content.map((part) => part.text ?? "").join(""));

/** A model that answers each request by what it sees, for conversations that interleave. */
export const routedModel = (
  answer: (request: ModelRequest) => AssistantMessage | Promise<AssistantMessage>,
) => {
  const response: FauxResponseFactory = (context, options) => {
    const tools = new Set<string>();
    const sections = new Map<string, string>();
    const instructions: string[] = [];

    for (const message of context.messages) {
      if (message.role === "system") {
        const text = textOf(message.content);

        if (text !== "") {
          instructions.push(text);
        }

        for (const [name, content] of Object.entries(message.sections ?? {})) {
          if (content == null) {
            sections.delete(name);
          } else {
            sections.set(name, content);
          }
        }

        for (const tool of message.toolsAdded ?? []) {
          tools.add(tool.name);
        }

        for (const tool of message.toolsRemoved ?? []) {
          tools.delete(tool.name);
        }
      }
    }

    const last = context.messages.findLast((message) => message.role !== "system");

    return answer({
      last: last == null ? "" : textOf(last.content),
      lastRole: last?.role ?? "",
      tools,
      sections,
      instructions: instructions.join("\n\n"),
      signal: options?.signal,
    });
  };

  return Array.from({ length: 50 }, () => response);
};
