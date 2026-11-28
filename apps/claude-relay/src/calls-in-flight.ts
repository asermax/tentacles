import type { ServerResponse } from "node:http";
import { finished } from "node:stream/promises";

import type { AssistantMessageEvent } from "@earendil-works/pi-ai";
import type { CallId } from "@tentacles/relay-protocol/call-id";
import { eventLine } from "@tentacles/relay-protocol/event-line";
import { failedEvent, type FailedEventModel } from "@tentacles/relay-protocol/failed-event";
import { lostCallMessage } from "@tentacles/relay-protocol/lost-call";
import type { StreamRequest } from "@tentacles/relay-protocol/stream-request";

import { CallOutcome } from "./call-outcome";
import { errorRecord, LogRecord, type Log } from "./log";
import type { ReportEnd } from "./report-end";

export interface CallDetails {
  readonly sender: StreamRequest["sender"];
  readonly conversation: string | undefined;
  readonly model: FailedEventModel;
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
  /** Writes an event to the call's response, unless the response has ended, as when the relay's stop closed it. */
  readonly send: (event: AssistantMessageEvent) => void;
  /** The call ended. Only the first ending counts. */
  readonly finish: (outcome: CallOutcome) => void;
  /** The call threw: logs the error with the call's id and sender, then finishes it as failed. */
  readonly fail: (cause: unknown) => void;
}

export interface CallsInFlightDependencies {
  readonly reportEnd: ReportEnd;
  readonly log: Log;
}

const stoppingReason = "the relay is stopping";

const answerStopping = (response: ServerResponse) => {
  response.writeHead(503, { "content-type": "text/plain" });
  response.end(lostCallMessage(stoppingReason));
};

const writeEvent = (response: ServerResponse, event: AssistantMessageEvent) => {
  if (!response.writableEnded) {
    response.write(eventLine(event));
  }
};

// The CLI is aborted first, and the session gets the lost-call error so it retries on the next container.
const endAsLost = (call: Call) => {
  const { response, controller, details } = call;

  controller.abort();

  if (response.writableEnded) {
    return Promise.resolve();
  }

  if (details == null) {
    answerStopping(response);
  } else {
    writeEvent(response, failedEvent(details.model, lostCallMessage(stoppingReason)));
    response.end();
  }

  return finished(response).catch(() => {});
};

/**
 * The calls in flight, keyed by the call id the Claude object gave each. A call finishes in one place,
 * which logs its end, forgets it and reports it, whatever ended it.
 */
export const createCallsInFlight = ({ reportEnd, log }: CallsInFlightDependencies) => {
  const callsById = new Map<CallId, Call>();

  let stopping: Promise<void> | undefined;

  const finishCall = (callId: CallId, outcome: CallOutcome) => {
    const call = callsById.get(callId);

    if (call == null) {
      return Promise.resolve();
    }

    callsById.delete(callId);

    log(
      LogRecord.cases.CallEnd.make({
        callId,
        details:
          call.details == null
            ? undefined
            : { sender: call.details.sender, conversation: call.details.conversation },
        outcome,
      }),
    );

    const responseEnded = CallOutcome.guards.Stopped(outcome) ? endAsLost(call) : Promise.resolve();

    void reportEnd(callId);

    return responseEnded;
  };

  const endAllCalls = async () => {
    await Promise.all(
      [...callsById.keys()].map((callId) => finishCall(callId, CallOutcome.cases.Stopped.make({}))),
    );
  };

  return {
    /** Counts a request as the call with the given id. */
    track: (callId: CallId, response: ServerResponse, controller: AbortController): TrackedCall => {
      const call: Call = { response, controller };

      callsById.set(callId, call);

      return {
        start: (details) => {
          call.details = details;

          log(
            LogRecord.cases.CallStart.make({
              callId,
              sender: details.sender,
              conversation: details.conversation,
              modelId: details.model.id,
            }),
          );
        },
        send: (event) => writeEvent(response, event),
        finish: (outcome) => {
          void finishCall(callId, outcome);
        },
        fail: (cause) => {
          const record = errorRecord(cause, { callId, sender: call.details?.sender });

          log(record);
          void finishCall(
            callId,
            CallOutcome.cases.Failed.make({ errorMessage: record.errorMessage }),
          );
        },
      };
    },

    /** Whether a stop has begun, which is when the relay takes no new call. */
    isStopping: () => stopping != null,

    /** Answers a request that arrives once the relay is stopping with 503 and the lost-call wording; reports whether it did. */
    refuseWhileStopping: (response: ServerResponse) => {
      if (stopping == null) {
        return false;
      }

      answerStopping(response);

      return true;
    },

    /** Takes no new call and ends every call in flight as stopped, resolving once their responses have been written. Stopping again returns the same promise. */
    stop: () => (stopping ??= endAllCalls()),
  };
};

export type CallsInFlight = ReturnType<typeof createCallsInFlight>;
