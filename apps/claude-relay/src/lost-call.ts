import { lostCallMessage } from "@tentacles/relay-protocol/lost-call";
import * as Schema from "effect/Schema";

const FailureKind = Schema.Union([
  Schema.TaggedStruct("Signal", {}),
  Schema.TaggedStruct("ConnectionLost", {}),
  Schema.TaggedStruct("Other", {}),
]).pipe(Schema.toTaggedUnion("_tag"));

type FailureKind = typeof FailureKind.Type;

const exitedBySignal = /^Claude Code exited from signal /;

const exitedWithCode =
  /^Claude Code exited before (?:completing its response|acknowledging history replay) \(exit (\d+)/;

const connectionLost = /connection.?lost/i;

// An exit code of 128 or more is a signal that killed the process, as the shell reports it.
const firstSignalCode = 128;

const failureKindOf = (errorMessage: string): FailureKind => {
  const exitCode = exitedWithCode.exec(errorMessage)?.[1];

  if (
    exitedBySignal.test(errorMessage) ||
    (exitCode != null && Number(exitCode) >= firstSignalCode)
  ) {
    return FailureKind.cases.Signal.make({});
  }

  return connectionLost.test(errorMessage)
    ? FailureKind.cases.ConnectionLost.make({})
    : FailureKind.cases.Other.make({});
};

/**
 * The message to send for a failed call. pi-durable retries a call from its error text alone, so a
 * call the CLI lost to a signal gets the lost-call wording; a connection lost already matches it,
 * and any other failure stays as it is.
 */
export const asLostCall = (errorMessage: string) =>
  FailureKind.match(failureKindOf(errorMessage), {
    Signal: () => lostCallMessage(errorMessage),
    ConnectionLost: () => errorMessage,
    Other: () => errorMessage,
  });

export const isLostCall = (errorMessage: string) =>
  !FailureKind.guards.Other(failureKindOf(errorMessage));
