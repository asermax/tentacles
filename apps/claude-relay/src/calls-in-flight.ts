import type { ServerResponse } from "node:http";
import { finished } from "node:stream/promises";

import type { AssistantMessageEvent } from "@earendil-works/pi-ai";
import type { CallId } from "@tentacles/relay-protocol/call-id";
import { lostCallMessage } from "@tentacles/relay-protocol/lost-call";
import type { StreamRequest } from "@tentacles/relay-protocol/stream-request";
import * as Option from "effect/Option";

import { CallOutcome } from "./call-outcome";
import { errorRecord, LogRecord } from "./log";

export interface CallDetails {
  readonly sender: StreamRequest["sender"];
  readonly conversation: string | undefined;
  readonly modelId: string;
}

interface Call {
  readonly response: ServerResponse;
  readonly controller: AbortController;
  details?: CallDetails;
}

/** One request's part in the relay's account of its calls. */
export interface TrackedCall {
  /** The call's details are known and it goes on to the model. */
  readonly start: (details: CallDetails) => void;
  /** The call ended. Only the first ending counts. */
  readonly finish: (outcome: CallOutcome) => void;
  /** The call threw: logs the error with the call's id and sender, then finishes it as failed. */
  readonly fail: (cause: unknown) => void;
}

interface Dependencies {
  readonly reportEnd: (callId: CallId) => Promise<void>;
  readonly log: (record: LogRecord) => void;
}

const stoppingReason = "the relay is stopping";

const emptyUsage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

const stoppedEvent = (modelId: string | undefined): AssistantMessageEvent => ({
  type: "error",
  reason: "error",
  error: {
    role: "assistant",
    content: [],
    api: "claude-relay",
    provider: "claude",
    model: modelId ?? "",
    usage: emptyUsage,
    stopReason: "error",
    errorMessage: lostCallMessage(stoppingReason),
    timestamp: Date.now(),
  },
});

// The CLI is aborted first, and the session gets the lost-call error so it retries on the next container.
const endAsLost = (call: Call) => {
  const { response, controller, details } = call;

  controller.abort();

  if (response.writableEnded) {
    return Promise.resolve();
  }

  if (response.headersSent) {
    response.write(`${JSON.stringify(stoppedEvent(details?.modelId))}\n`);
    response.end();
  } else {
    response.writeHead(503, { "content-type": "text/plain" });
    response.end(lostCallMessage(stoppingReason));
  }

  return finished(response).catch(() => {});
};

const untracked: TrackedCall = {
  start: () => {},
  finish: () => {},
  fail: () => {},
};

/**
 * The calls in flight, keyed by the call id the Claude object gave each. A call finishes in one place,
 * which logs its end, forgets it and reports it, whatever ended it.
 */
export const createCallsInFlight = ({ reportEnd, log }: Dependencies) => {
  const calls = new Map<CallId, Call>();

  const finish = (callId: CallId, outcome: CallOutcome) => {
    const call = calls.get(callId);

    if (call == null) {
      return Promise.resolve();
    }

    calls.delete(callId);

    log(
      LogRecord.cases.CallEnd.make({
        callId,
        sender: call.details?.sender,
        conversation: call.details?.conversation,
        outcome,
      }),
    );

    const ended = CallOutcome.guards.Stopped(outcome) ? endAsLost(call) : Promise.resolve();

    void reportEnd(callId);

    return ended;
  };

  return {
    /** Counts a request as a call when it carries a call id; a request without one is not tracked. */
    track: (
      callId: Option.Option<CallId>,
      response: ServerResponse,
      controller: AbortController,
    ): TrackedCall =>
      Option.match(callId, {
        onNone: () => ({
          ...untracked,
          fail: (cause: unknown) => log(errorRecord(cause)),
        }),
        onSome: (id) => {
          const call: Call = { response, controller };

          calls.set(id, call);

          return {
            start: (details) => {
              call.details = details;

              log(
                LogRecord.cases.CallStart.make({
                  callId: id,
                  sender: details.sender,
                  conversation: details.conversation,
                  modelId: details.modelId,
                }),
              );
            },
            finish: (outcome) => {
              void finish(id, outcome);
            },
            fail: (cause) => {
              const record = errorRecord(cause, { callId: id, sender: call.details?.sender });

              log(record);
              void finish(id, CallOutcome.cases.Failed.make({ errorMessage: record.errorMessage }));
            },
          };
        },
      }),

    /** Ends every call in flight as stopped, resolving once their responses have been written. */
    endAll: async () => {
      await Promise.all(
        [...calls.keys()].map((callId) => finish(callId, CallOutcome.cases.Stopped.make({}))),
      );
    },
  };
};

export type CallsInFlight = ReturnType<typeof createCallsInFlight>;
