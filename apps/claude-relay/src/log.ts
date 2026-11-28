import { CallId } from "@tentacles/relay-protocol/call-id";
import { StreamRequest } from "@tentacles/relay-protocol/stream-request";
import * as Schema from "effect/Schema";

import { CallOutcome } from "./call-outcome";

const Sender = StreamRequest.fields.sender;

const CallEndDetails = Schema.Struct({
  sender: Sender,
  conversation: Schema.optional(Schema.String),
});

const ErrorCall = Schema.Struct({ callId: CallId, sender: Schema.optional(Sender) });

/**
 * What the relay writes to stdout, one JSON object per line, which reaches Workers observability. A
 * record never holds a prompt, a message part or an output.
 */
export const LogRecord = Schema.Union([
  Schema.TaggedStruct("RelayStart", { port: Schema.Int }),
  Schema.TaggedStruct("RelaySignal", { signal: Schema.String }),
  Schema.TaggedStruct("RelayExit", {}),
  Schema.TaggedStruct("CallStart", {
    callId: CallId,
    sender: Sender,
    conversation: Schema.optional(Schema.String),
    modelId: Schema.String,
  }),
  Schema.TaggedStruct("CallEnd", {
    callId: CallId,
    details: Schema.optional(CallEndDetails),
    outcome: CallOutcome,
  }),
  Schema.TaggedStruct("Error", {
    errorMessage: Schema.String,
    stack: Schema.optional(Schema.String),
    call: Schema.optional(ErrorCall),
  }),
]).pipe(Schema.toTaggedUnion("_tag"));

export type LogRecord = typeof LogRecord.Type;

const encodeLogRecord = Schema.encodeSync(Schema.fromJsonString(LogRecord));

export type Log = (record: LogRecord) => void;

export const writeLog = (record: LogRecord) => {
  process.stdout.write(`${encodeLogRecord(record)}\n`);
};

export const messageOf = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause);

/** The Error record for anything thrown or rejected, with the call it happened in when there is one. */
export const errorRecord = (cause: unknown, call?: typeof ErrorCall.Type) =>
  LogRecord.cases.Error.make({
    errorMessage: messageOf(cause),
    stack: cause instanceof Error ? cause.stack : undefined,
    call,
  });
