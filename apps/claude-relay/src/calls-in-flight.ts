import type { ServerResponse } from "node:http";
import { finished } from "node:stream/promises";

import type { CallId } from "@tentacles/relay-protocol/call-id";
import { failedEvent, type FailedEventModel } from "@tentacles/relay-protocol/failed-event";
import { lostCallMessage } from "@tentacles/relay-protocol/lost-call";
import type { StreamRequest } from "@tentacles/relay-protocol/stream-request";
import * as Option from "effect/Option";

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
    response.write(
      `${JSON.stringify(failedEvent(details.model, lostCallMessage(stoppingReason)))}\n`,
    );
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

  let isStopping = false;

  const finishCall = (callId: CallId, outcome: CallOutcome) => {
    const call = callsById.get(callId);

    if (call == null) {
      return Promise.resolve();
    }

    callsById.delete(callId);

    log(
      LogRecord.cases.CallEnd.make({
        callId,
        sender: call.details?.sender,
        conversation: call.details?.conversation,
        outcome,
      }),
    );

    const responseEnded = CallOutcome.guards.Stopped(outcome) ? endAsLost(call) : Promise.resolve();

    void reportEnd(callId);

    return responseEnded;
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
          start: () => {},
          finish: () => {},
          fail: (cause: unknown) => log(errorRecord(cause)),
        }),
        onSome: (id) => {
          const call: Call = { response, controller };

          callsById.set(id, call);

          return {
            start: (details) => {
              call.details = details;

              log(
                LogRecord.cases.CallStart.make({
                  callId: id,
                  sender: details.sender,
                  conversation: details.conversation,
                  modelId: details.model.id,
                }),
              );
            },
            finish: (outcome) => {
              void finishCall(id, outcome);
            },
            fail: (cause) => {
              const record = errorRecord(cause, { callId: id, sender: call.details?.sender });

              log(record);
              void finishCall(
                id,
                CallOutcome.cases.Failed.make({ errorMessage: record.errorMessage }),
              );
            },
          };
        },
      }),

    /** Answers a request that arrives once the relay is stopping with 503 and the lost-call wording; reports whether it did. */
    refuseWhileStopping: (response: ServerResponse) => {
      if (isStopping) {
        answerStopping(response);
      }

      return isStopping;
    },

    /** Takes no new call and ends every call in flight as stopped, resolving once their responses have been written. */
    stop: async () => {
      isStopping = true;

      await Promise.all(
        [...callsById.keys()].map((callId) =>
          finishCall(callId, CallOutcome.cases.Stopped.make({})),
        ),
      );
    },
  };
};

export type CallsInFlight = ReturnType<typeof createCallsInFlight>;
