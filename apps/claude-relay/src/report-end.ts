import { endReportPath } from "@tentacles/relay-protocol/end-report";
import type { CallId } from "@tentacles/relay-protocol/call-id";

import { errorRecord, type LogRecord } from "./log";

// The container's loopback interception answers this host; it is not on any network.
const endReportHost = "tentacles.internal";

const endReportTimeoutMs = 5_000;

/** Tells the Claude object a call ended. A failure is logged and dropped, since the object clears its count when the container stops. */
export const createReportEnd =
  (log: (record: LogRecord) => void) =>
  async (callId: CallId): Promise<void> => {
    try {
      const response = await fetch(`http://${endReportHost}${endReportPath(callId)}`, {
        method: "POST",
        signal: AbortSignal.timeout(endReportTimeoutMs),
      });

      if (!response.ok) {
        throw new Error(`The end report was answered ${response.status}`);
      }
    } catch (error) {
      log(errorRecord(error, { callId }));
    }
  };
