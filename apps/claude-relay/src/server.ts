import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { text } from "node:stream/consumers";

import { normalizeContext, type Message } from "@earendil-works/pi-ai";
import { CLAUDE_CODE_MODELS } from "@earendil-works/pi-claude-code/src/model-catalog.ts";
import { streamClaudeCode } from "@earendil-works/pi-claude-code/src/stream.ts";
import { callIdHeader, decodeCallId } from "@tentacles/relay-protocol/call-id";
import { decodeStreamRequest } from "@tentacles/relay-protocol/stream-request";
import * as Option from "effect/Option";

import { CallOutcome } from "./call-outcome";
import {
  createCallsInFlight,
  type CallsInFlight,
  type CallsInFlightDependencies,
} from "./calls-in-flight";
import { egressCaTrust } from "./egress-ca";
import { eventToRelay } from "./event-to-relay";
import { errorRecord, messageOf } from "./log";
import { resolveModel } from "./resolve-model";

const health = (response: ServerResponse) => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true, models: CLAUDE_CODE_MODELS.map((model) => model.id) }));
};

const failResponse = (response: ServerResponse, cause: unknown) => {
  if (response.headersSent) {
    response.end();

    return;
  }

  response.writeHead(502, { "content-type": "text/plain" });
  response.end(messageOf(cause));
};

const stream = async (
  callsInFlight: CallsInFlight,
  request: IncomingMessage,
  response: ServerResponse,
) => {
  // Also fires once the response ends; aborting a finished call does nothing.
  const controller = new AbortController();

  response.on("close", () => controller.abort());

  const trackedCall = callsInFlight.track(
    decodeCallId(request.headers[callIdHeader]),
    response,
    controller,
  );

  const reject = (message: string) => {
    response.writeHead(400, { "content-type": "text/plain" });
    response.end(message);
    trackedCall.finish(CallOutcome.cases.Failed.make({ errorMessage: message }));
  };

  try {
    const streamRequest = decodeStreamRequest(await text(request));

    if (Option.isNone(streamRequest)) {
      reject("invalid request body");

      return;
    }

    const { modelId, context, options, sender } = streamRequest.value;
    const model = await resolveModel(modelId);

    if (model == null) {
      reject(`unknown model ${modelId}`);

      return;
    }

    trackedCall.start({ sender, conversation: options.sessionId, model });
    response.writeHead(200, { "content-type": "application/x-ndjson" });

    const events = streamClaudeCode(
      model,
      // SAFETY: the Claude provider sends the transcript pi-ai gave it, and pi-claude-code reads each
      // message's parts when it builds the CLI's frames; pi-ai has no runtime schema to decode it with.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      normalizeContext({ messages: context.messages as Array<Message> }),
      { ...options, signal: controller.signal },
    );

    let outcome: CallOutcome = CallOutcome.cases.Failed.make({
      errorMessage: "The call ended without a result",
    });

    for await (const event of events) {
      const { eventToSend, outcome: eventOutcome } = eventToRelay(event);

      outcome = eventOutcome ?? outcome;

      // The call may have been ended by the relay's stop, which closed the response.
      if (!response.writableEnded) {
        response.write(`${JSON.stringify(eventToSend)}\n`);
      }
    }

    response.end();
    trackedCall.finish(outcome);
  } catch (cause) {
    trackedCall.fail(cause);
    failResponse(response, cause);
  }
};

interface Dependencies extends CallsInFlightDependencies {
  readonly egressCaPath: string;
}

/**
 * The relay: POST /stream runs one pi-claude-code call and streams its pi-ai events as NDJSON, ending
 * with done or error; GET / answers health and the catalog. A request that carries a call id is counted
 * as a call and reported to the Claude object when it ends. It trusts the egress CA at `egressCaPath`
 * from the first request that finds the file. `stop` ends every call in flight as lost and has the relay
 * answer a new call with 503; the server is not listening yet and is closed by the caller.
 */
export const createRelay = ({ egressCaPath, reportEnd, log }: Dependencies) => {
  const trustEgressCa = egressCaTrust(egressCaPath);
  const callsInFlight = createCallsInFlight({ reportEnd, log });

  const route = (request: IncomingMessage, response: ServerResponse) => {
    if (request.method === "GET" && request.url === "/") {
      health(response);

      return Promise.resolve();
    }

    if (request.method === "POST" && request.url === "/stream") {
      return callsInFlight.refuseWhileStopping(response)
        ? Promise.resolve()
        : stream(callsInFlight, request, response);
    }

    response.writeHead(404).end();

    return Promise.resolve();
  };

  const server = createServer((request, response) => {
    trustEgressCa();

    route(request, response).catch((cause) => {
      log(errorRecord(cause));
      failResponse(response, cause);
    });
  });

  return { server, stop: callsInFlight.stop };
};
