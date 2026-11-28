import * as Schema from "effect/Schema";

/** Names one call the Claude object forwarded to the relay. */
export const CallId = Schema.String.check(Schema.isUUID()).pipe(Schema.brand("CallId"));

export type CallId = typeof CallId.Type;

export const decodeCallId = Schema.decodeUnknownOption(CallId);

/** A new CallId: a random UUID. */
export const newCallId = () => Schema.decodeSync(CallId)(crypto.randomUUID());

/** The request header that carries the CallId from the Claude object to the relay. */
export const callIdHeader = "x-tentacles-call-id";
