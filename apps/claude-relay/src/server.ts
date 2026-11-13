import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { text } from "node:stream/consumers";

import { normalizeContext, type Message } from "@earendil-works/pi-ai";
import { CLAUDE_CODE_MODELS } from "@earendil-works/pi-claude-code/src/model-catalog.ts";
import { streamClaudeCode } from "@earendil-works/pi-claude-code/src/stream.ts";
import * as Option from "effect/Option";

import { egressCaTrust } from "./egress-ca";
import { resolveModel } from "./resolve-model";
import { decodeStreamRequest } from "./stream-request";

const health = (response: ServerResponse) => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true, models: CLAUDE_CODE_MODELS.map((model) => model.id) }));
};

const badRequest = (response: ServerResponse, message: string) => {
  response.writeHead(400, { "content-type": "text/plain" });
  response.end(message);
};

const stream = async (request: IncomingMessage, response: ServerResponse) => {
  const body = decodeStreamRequest(await text(request));

  if (Option.isNone(body)) {
    badRequest(response, "invalid request body");

    return;
  }

  const { modelId, context, options } = body.value;
  const model = await resolveModel(modelId);

  if (model == null) {
    badRequest(response, `unknown model ${modelId}`);

    return;
  }

  // Also fires once the response ends; aborting a finished call does nothing.
  const controller = new AbortController();

  response.on("close", () => controller.abort());
  response.writeHead(200, { "content-type": "application/x-ndjson" });

  const events = streamClaudeCode(
    model,
    // SAFETY: the relay provider sends the transcript pi-ai gave it, and pi-claude-code reads each
    // message's parts when it builds the CLI's frames; pi-ai has no runtime schema to decode it with.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    normalizeContext({ messages: context.messages as Array<Message> }),
    { ...options, signal: controller.signal },
  );

  for await (const event of events) {
    response.write(`${JSON.stringify(event)}\n`);
  }

  response.end();
};

const route = (request: IncomingMessage, response: ServerResponse) => {
  if (request.method === "GET" && request.url === "/") {
    health(response);

    return Promise.resolve();
  }

  if (request.method === "POST" && request.url === "/stream") {
    return stream(request, response);
  }

  response.writeHead(404).end();

  return Promise.resolve();
};

/**
 * The relay's HTTP server: POST /stream runs one pi-claude-code call and streams its pi-ai events as
 * NDJSON, ending with done or error; GET / answers health and the catalog. It trusts the egress CA at
 * `egressCaPath` from the first request that finds the file.
 */
export const relayServer = (egressCaPath: string) => {
  const trustEgressCa = egressCaTrust(egressCaPath);

  return createServer((request, response) => {
    trustEgressCa();

    route(request, response).catch((error) => {
      if (response.headersSent) {
        response.end();

        return;
      }

      response.writeHead(502, { "content-type": "text/plain" });
      response.end(error instanceof Error ? error.message : String(error));
    });
  });
};
