import * as Schema from "effect/Schema";

// Workers AI through the gateway, as the model of every test session. A prompt that starts with
// "SCRIPT " and a JSON list of tool calls makes the model make them one at a time, in order, and
// then answer "done"; any other prompt is answered "done" at once.

interface CompletionChunk {
  readonly id: string;
  readonly object: string;
  readonly choices: ReadonlyArray<{
    readonly index: number;
    readonly delta: {
      readonly role?: string;
      readonly content?: string;
      readonly tool_calls?: ReadonlyArray<{
        readonly index: number;
        readonly id: string;
        readonly type: "function";
        readonly function: { readonly name: string; readonly arguments: string };
      }>;
    };
    readonly finish_reason: string | null;
  }>;
  readonly usage?: {
    readonly prompt_tokens: number;
    readonly completion_tokens: number;
    readonly total_tokens: number;
  };
}

const chunkEvent = (body: CompletionChunk) => `data: ${JSON.stringify(body)}\n\n`;

const ContentParts = Schema.Array(Schema.Struct({ text: Schema.optional(Schema.String) }));

const Content = Schema.Union([Schema.String, ContentParts, Schema.Null]);

const Message = Schema.Struct({ role: Schema.String, content: Schema.optional(Content) });

const ChatRequest = Schema.Struct({ messages: Schema.Array(Message) });

const ToolCalls = Schema.Array(Schema.Struct({ name: Schema.String, arguments: Schema.String }));

const decodeRequest = Schema.decodeUnknownSync(ChatRequest);

const decodeToolCalls = Schema.decodeUnknownSync(Schema.fromJsonString(ToolCalls));

const scriptPrefix = "SCRIPT ";

const textOf = (content: typeof Content.Type | undefined) =>
  Schema.is(Schema.String)(content)
    ? content
    : Schema.is(ContentParts)(content)
      ? content.map((part) => part.text ?? "").join("")
      : "";

const eventStreamResponse = (chunks: ReadonlyArray<CompletionChunk>) =>
  new Response([...chunks.map(chunkEvent), "data: [DONE]\n\n"].join(""), {
    headers: { "content-type": "text/event-stream" },
  });

const usage = { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 };

const chunkOf = (choice: Omit<CompletionChunk["choices"][number], "index">): CompletionChunk => ({
  id: "test",
  object: "chat.completion.chunk",
  choices: [{ index: 0, ...choice }],
});

const textResponse = (content: string) =>
  eventStreamResponse([
    chunkOf({ delta: { role: "assistant", content }, finish_reason: null }),
    { ...chunkOf({ delta: {}, finish_reason: "stop" }), usage },
  ]);

const toolCallResponse = (toolResultCount: number, name: string, args: string) =>
  eventStreamResponse([
    chunkOf({
      delta: {
        role: "assistant",
        tool_calls: [
          {
            index: 0,
            id: `call-${toolResultCount}`,
            type: "function",
            function: { name, arguments: args },
          },
        ],
      },
      finish_reason: null,
    }),
    { ...chunkOf({ delta: {}, finish_reason: "tool_calls" }), usage },
  ]);

export const scriptedModel = async (request: Request) => {
  const { messages } = decodeRequest(await request.json());
  const lastPromptIndex = messages.findLastIndex((message) => message.role === "user");
  const prompt = textOf(messages[lastPromptIndex]?.content);

  if (!prompt.startsWith(scriptPrefix)) {
    return textResponse("done");
  }

  const scriptedCalls = decodeToolCalls(prompt.slice(scriptPrefix.length));

  const toolResultCount = messages
    .slice(lastPromptIndex)
    .filter((message) => message.role === "tool").length;

  const nextCall = scriptedCalls[toolResultCount];

  return nextCall == null
    ? textResponse("done")
    : toolCallResponse(toolResultCount, nextCall.name, nextCall.arguments);
};
