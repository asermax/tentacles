import { SessionStatuses, type SessionRef } from "@tentacles/worker-api/session-state";

export const isOpen = (session: SessionRef) => session.status !== SessionStatuses.closed;

/** The open sessions as `name: status`, or undefined when none is open so the glue clears the line. */
export const renderStatusLine = (sessions: ReadonlyArray<SessionRef>): string | undefined => {
  const open = sessions.filter(isOpen);

  if (open.length === 0) {
    return undefined;
  }

  return open.map((session) => `${session.name}: ${session.status}`).join(" | ");
};

/** Splits a stream's chunks into complete lines; a chunk may end mid-line or hold several lines. */
export const createLineSplitter = (onLine: (line: string) => void): ((chunk: string) => void) => {
  let buffer = "";

  return (chunk) => {
    buffer += chunk;

    for (let newline = buffer.indexOf("\n"); newline >= 0; newline = buffer.indexOf("\n")) {
      const line = buffer.slice(0, newline);

      buffer = buffer.slice(newline + 1);

      if (line.trim() !== "") {
        onLine(line);
      }
    }
  };
};
