import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { text } from "node:stream/consumers";

import { normalizeContext, type Message } from "@earendil-works/pi-ai";
import { CLAUDE_CODE_MODELS } from "@earendil-works/pi-claude-code/src/model-catalog.ts";
import { streamClaudeCode } from "@earendil-works/pi-claude-code/src/stream.ts";
import { CallId, callIdHeader } from "@tentacles/relay-protocol/call-id";
import { lostCallMessage } from "@tentacles/relay-protocol/lost-call";
import { decodeStreamRequest } from "@tentacles/relay-protocol/stream-request";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { CallOutcome } from "./call-outcome";
import { createCallsInFlight, type CallsInFlight } from "./calls-in-flight";
import { egressCaTrust } from "./egress-ca";
import { errorRecord, type LogRecord } from "./log";
import { asLostCall, isLostCall } from "./lost-call";
import { resolveModel } from "./resolve-model";

const decodeCallId = Schema.decodeUnknownOption(CallId);

const health = (response: ServerResponse) => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true, models: CLAUDE_CODE_MODELS.map((model) => model.id) }));
};

const badRequest = (response: ServerResponse, message: string) => {
  response.writeHead(400, { "content-type": "text/plain" });
  response.end(message);
};

const failResponse = (response: ServerResponse, cause: unknown) => {
  if (response.headersSent) {
    response.end();

    return;
  }

  response.writeHead(502, { "content-type": "text/plain" });
  response.end(cause instanceof Error ? cause.message : String(cause));
};

const stream = async (calls: CallsInFlight, request: IncomingMessage, response: ServerResponse) => {
  // Also fires once the response ends; aborting a finished call does nothing.
  const controller = new AbortController();

  response.on("close", () => controller.abort());

  const call = calls.track(decodeCallId(request.headers[callIdHeader]), response, controller);

  try {
    const body = decodeStreamRequest(await text(request));

    if (Option.isNone(body)) {
      badRequest(response, "invalid request body");
      call.finish(CallOutcome.cases.Failed.make({ errorMessage: "invalid request body" }));

      return;
    }

    const { modelId, context, options, sender } = body.value;
    const model = await resolveModel(modelId);

    if (model == null) {
      badRequest(response, `unknown model ${modelId}`);
      call.finish(CallOutcome.cases.Failed.make({ errorMessage: `unknown model ${modelId}` }));

      return;
    }

    call.start({ sender, conversation: options.sessionId, modelId });
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
      let sent = event;

      if (event.type === "done") {
        outcome = CallOutcome.cases.Done.make({});
      }

      if (event.type === "error" && event.reason === "aborted") {
        outcome = CallOutcome.cases.Aborted.make({});
      }

      if (event.type === "error" && event.reason === "error") {
        const errorMessage = event.error.errorMessage ?? "";
        const sentMessage = asLostCall(errorMessage);

        sent = { ...event, error: { ...event.error, errorMessage: sentMessage } };
        outcome = isLostCall(errorMessage)
          ? CallOutcome.cases.Lost.make({ errorMessage: sentMessage })
          : CallOutcome.cases.Failed.make({ errorMessage });
      }

      // The call may have been ended by the relay's stop, which closed the response.
      if (!response.writableEnded) {
        response.write(`${JSON.stringify(sent)}\n`);
      }
    }

    if (!response.writableEnded) {
      response.end();
    }

    call.finish(outcome);
  } catch (cause) {
    call.fail(cause);
    failResponse(response, cause);
  }
};

interface Dependencies {
  readonly egressCaPath: string;
  readonly reportEnd: (callId: CallId) => Promise<void>;
  readonly log: (record: LogRecord) => void;
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
  const calls = createCallsInFlight({ reportEnd, log });

  let isStopping = false;

  const route = (request: IncomingMessage, response: ServerResponse) => {
    if (request.method === "GET" && request.url === "/") {
      health(response);

      return Promise.resolve();
    }

    if (request.method === "POST" && request.url === "/stream") {
      if (isStopping) {
        response.writeHead(503, { "content-type": "text/plain" });
        response.end(lostCallMessage("the relay is stopping"));

        return Promise.resolve();
      }

      return stream(calls, request, response);
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

  return {
    server,

    stop: async () => {
      isStopping = true;

      await calls.endAll();
    },
  };
};
