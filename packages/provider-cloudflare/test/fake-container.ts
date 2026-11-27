import type { AssistantMessage, AssistantMessageEvent, ToolCall } from "@earendil-works/pi-ai";
import { callIdHeader } from "@tentacles/relay-protocol/call-id";
import { lostCallMessage } from "@tentacles/relay-protocol/lost-call";

/** How the scripted relay answers one POST /stream. */
export type RelayAnswer =
  | "done"
  | "lost"
  | "refusal"
  | "stopping"
  | "cut"
  | "unreachable"
  | "subagent";

export interface FakeContainerSetup {
  readonly isRunning: boolean;
  /** The relay refuses its probes until this one, counting from the container's start. */
  readonly readyOnProbe: number;
  /** One answer per call in order; the last repeats. */
  readonly answers: ReadonlyArray<RelayAnswer>;
}

export interface RelayRequest {
  readonly callId: string | null;
  /** The request body as the relay received it. */
  readonly body: string;
  readonly probesAnswered: number;
  readonly receivedAt: number;
}

const assistantMessage = (overrides: Partial<AssistantMessage> = {}): AssistantMessage => ({
  role: "assistant",
  content: [],
  api: "claude-relay",
  provider: "claude",
  model: "claude-sonnet-5-5",
  usage: {
    input: 1,
    output: 1,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 2,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
  stopReason: "stop",
  timestamp: 0,
  ...overrides,
});

const answerText = "done";

const doneEvents = (): ReadonlyArray<AssistantMessageEvent> => [
  { type: "start", partial: assistantMessage() },
  { type: "text_start", contentIndex: 0, partial: assistantMessage() },
  {
    type: "text_delta",
    contentIndex: 0,
    delta: answerText,
    partial: assistantMessage({ content: [{ type: "text", text: answerText }] }),
  },
  {
    type: "text_end",
    contentIndex: 0,
    content: answerText,
    partial: assistantMessage({ content: [{ type: "text", text: answerText }] }),
  },
  {
    type: "done",
    reason: "stop",
    message: assistantMessage({ content: [{ type: "text", text: answerText }] }),
  },
];

const subagentCall = {
  type: "toolCall",
  id: "call-subagent",
  name: "subagent",
  arguments: { action: "run", task: "Say done." },
} as const satisfies ToolCall;

// The model asks for a subagent, which makes its own calls to the relay.
const subagentEvents = (): ReadonlyArray<AssistantMessageEvent> => [
  { type: "start", partial: assistantMessage() },
  {
    type: "toolcall_end",
    contentIndex: 0,
    toolCall: subagentCall,
    partial: assistantMessage({ content: [subagentCall] }),
  },
  {
    type: "done",
    reason: "toolUse",
    message: assistantMessage({ content: [subagentCall], stopReason: "toolUse" }),
  },
];

const errorEvents = (errorMessage: string): ReadonlyArray<AssistantMessageEvent> => [
  { type: "start", partial: assistantMessage() },
  {
    type: "error",
    reason: "error",
    error: assistantMessage({ stopReason: "error", errorMessage }),
  },
];

const ndjson = (events: ReadonlyArray<AssistantMessageEvent>) =>
  events.map((event) => `${JSON.stringify(event)}\n`).join("");

const answerResponses = {
  done: () => new Response(ndjson(doneEvents())),

  lost: () =>
    new Response(ndjson(errorEvents(lostCallMessage("Claude Code exited from signal SIGTERM")))),

  refusal: () => new Response(ndjson(errorEvents("Claude refused the request"))),

  stopping: () => new Response(lostCallMessage("the relay is stopping"), { status: 503 }),

  cut: () => new Response(ndjson(doneEvents().slice(0, 1))),

  subagent: () => new Response(ndjson(subagentEvents())),

  unreachable: () => {
    throw new TypeError("The container is not listening");
  },
} satisfies Record<RelayAnswer, () => Response>;

export type FakeContainerSnapshot = ReturnType<ReturnType<typeof createFakeContainer>["snapshot"]>;

/**
 * Stands in for the container a Claude object holds: it records what the object does to it and
 * serves a scripted relay on the port the object forwards to. The interception and the inactivity
 * timeout are cleared by a start, as the platform clears them.
 */
export const createFakeContainer = () => {
  let isRunning = false;
  let readyOnProbe = 1;
  let answers: ReadonlyArray<RelayAnswer> = ["done"];
  let probesAnswered = 0;
  let callsAnswered = 0;
  let inactivityTimeoutMs: number | null = null;

  let starts: Array<ContainerStartupOptions> = [];
  let signals: Array<number> = [];
  let interceptions: Array<{ protocol: "http" | "https"; host: string }> = [];
  let relayRequests: Array<RelayRequest> = [];
  let openMonitors: Array<() => void> = [];

  const relayFetch = async (input: RequestInfo, init?: RequestInit) => {
    const request = new Request(input, init);
    const { pathname } = new URL(request.url);

    if (request.method === "GET" && pathname === "/") {
      probesAnswered += 1;

      if (probesAnswered < readyOnProbe) {
        throw new TypeError("The container is not listening");
      }

      return Response.json({ ok: true });
    }

    if (request.method === "POST" && pathname === "/stream") {
      relayRequests.push({
        callId: request.headers.get(callIdHeader),
        body: await request.text(),
        probesAnswered,
        receivedAt: Date.now(),
      });

      const answer = answers[Math.min(callsAnswered, answers.length - 1)] ?? "done";

      callsAnswered += 1;

      return answerResponses[answer]();
    }

    return new Response(null, { status: 404 });
  };

  const stop = () => {
    isRunning = false;

    for (const settle of openMonitors) {
      settle();
    }

    openMonitors = [];
  };

  const container = {
    get running() {
      return isRunning;
    },

    get images() {
      return { ClaudeContainer: "fake-claude-image" };
    },

    start: (options: ContainerStartupOptions) => {
      isRunning = true;
      probesAnswered = 0;
      inactivityTimeoutMs = null;
      interceptions = [];
      starts.push(options);
    },

    monitor: () =>
      isRunning
        ? new Promise<void>((resolve) => {
            openMonitors.push(resolve);
          })
        : Promise.resolve(),

    signal: (signo: number) => {
      signals.push(signo);
    },

    getTcpPort: () => ({ fetch: relayFetch }),

    setInactivityTimeout: async (durationMs: number | bigint) => {
      inactivityTimeoutMs = Number(durationMs);
    },

    interceptOutboundHttp: async (host: string) => {
      interceptions.push({ protocol: "http", host });
    },

    interceptOutboundHttps: async (host: string) => {
      interceptions.push({ protocol: "https", host });
    },
  };

  return {
    container,

    /** Ends the container: it stops running and every monitor() settles. */
    stop,

    /** Starts over from a container in the given state, with nothing recorded. */
    reset: (setup: FakeContainerSetup) => {
      stop();

      isRunning = setup.isRunning;
      readyOnProbe = setup.readyOnProbe;
      answers = setup.answers;
      probesAnswered = 0;
      callsAnswered = 0;
      inactivityTimeoutMs = null;
      starts = [];
      signals = [];
      interceptions = [];
      relayRequests = [];
    },

    snapshot: () => ({
      isRunning,
      starts,
      signals,
      inactivityTimeoutMs,
      interceptions,
      relayRequests,
      openMonitorCount: openMonitors.length,
    }),
  };
};
