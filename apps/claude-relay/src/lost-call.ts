import { isLostCallMessage, lostCallMessage } from "@tentacles/relay-protocol/lost-call";

import { CallOutcome } from "./call-outcome";

const exitedBySignalPattern = /^Claude Code exited from signal /;

const exitedWithCodePattern =
  /^Claude Code exited before (?:completing its response|acknowledging history replay) \(exit (\d+)/;

// An exit code of 128 or more is a signal that killed the process, as the shell reports it.
const firstSignalCode = 128;

const isKilledBySignal = (errorMessage: string) => {
  const exitCodeText = exitedWithCodePattern.exec(errorMessage)?.[1];

  return (
    exitedBySignalPattern.test(errorMessage) ||
    (exitCodeText != null && Number(exitCodeText) >= firstSignalCode)
  );
};

/**
 * How a failed call ended, with the message to send. pi-durable retries a call from its error text
 * alone, so a call the CLI lost to a signal gets the lost-call wording; a connection lost already
 * matches it, and any other failure stays as it is.
 */
export const outcomeOfFailure = (errorMessage: string) => {
  const message = isKilledBySignal(errorMessage) ? lostCallMessage(errorMessage) : errorMessage;

  return isLostCallMessage(message)
    ? CallOutcome.cases.Lost.make({ errorMessage: message })
    : CallOutcome.cases.Failed.make({ errorMessage: message });
};
