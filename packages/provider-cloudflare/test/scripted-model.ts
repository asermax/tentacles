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

const chunk = (body: CompletionChunk) => `data: ${JSON.stringify(body)}\n\n`;

const Content = Schema.Union([
  Schema.String,
  Schema.Array(Schema.Struct({ text: Schema.optional(Schema.String) })),
  Schema.Null,
]);

const Message = Schema.Struct({ role: Schema.String, content: Schema.optional(Content) });

const ChatRequest = Schema.Struct({ messages: Schema.Array(Message) });

const ToolCalls = Schema.Array(Schema.Struct({ name: Schema.String, arguments: Schema.String }));

const decodeRequest = Schema.decodeUnknownSync(ChatRequest);

const decodeToolCalls = Schema.decodeUnknownSync(Schema.fromJsonString(ToolCalls));

const scriptPrefix = "SCRIPT ";

const textOf = (content: typeof Content.Type | undefined) =>
  Schema.is(Schema.String)(content)
    ? content
    : Schema.is(Schema.Array(Schema.Struct({ text: Schema.optional(Schema.String) })))(content)
      ? content.map((part) => part.text ?? "").join("")
      : "";

const response = (chunks: ReadonlyArray<CompletionChunk>) =>
  new Response([...chunks.map(chunk), "data: [DONE]\n\n"].join(""), {
    headers: { "content-type": "text/event-stream" },
  });

const usage = { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 };

const say = (content: string) =>
  response([
    {
      id: "test",
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }],
    },
    {
      id: "test",
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      usage,
    },
  ]);

const call = (step: number, name: string, args: string) =>
  response([
    {
      id: "test",
      object: "chat.completion.chunk",
      choices: [
        {
          index: 0,
          delta: {
            role: "assistant",
            tool_calls: [
              {
                index: 0,
                id: `call-${step}`,
                type: "function",
                function: { name, arguments: args },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    },
    {
      id: "test",
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
      usage,
    },
  ]);

export const scriptedModel = async (request: Request) => {
  const { messages } = decodeRequest(await request.json());
  const lastPrompt = messages.findLastIndex((message) => message.role === "user");
  const prompt = textOf(messages[lastPrompt]?.content);

  if (!prompt.startsWith(scriptPrefix)) {
    return say("done");
  }

  const calls = decodeToolCalls(prompt.slice(scriptPrefix.length));
  const step = messages.slice(lastPrompt).filter((message) => message.role === "tool").length;
  const next = calls[step];

  return next == null ? say("done") : call(step, next.name, next.arguments);
};
