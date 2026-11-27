import * as Schema from "effect/Schema";

/** What the echo handler answers a test with: the request's url and headers. */
export const Forwarded = Schema.Struct({
  url: Schema.String,
  headers: Schema.Record(Schema.String, Schema.String),
});

/**
 * Answers a request with what it carried, so a test reads the forwarded request from the response.
 */
export const echo = async (request: Request) =>
  Response.json({
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers),
  });
