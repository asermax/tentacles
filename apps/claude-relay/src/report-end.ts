import type { CallId } from "@tentacles/relay-protocol/call-id";
import { endReportHost, endReportPath } from "@tentacles/relay-protocol/end-report";

import { errorRecord, type Log } from "./log";

const endReportTimeoutMs = 5_000;

export type ReportEnd = (callId: CallId) => Promise<void>;

/** Tells the Claude object a call ended. A failure is logged and dropped, since the object clears its count when the container stops. */
export const createReportEnd =
  (log: Log): ReportEnd =>
  async (callId) => {
    try {
      const endReportResponse = await fetch(`http://${endReportHost}${endReportPath(callId)}`, {
        method: "POST",
        signal: AbortSignal.timeout(endReportTimeoutMs),
      });

      if (!endReportResponse.ok) {
        throw new Error(`The end report was answered ${endReportResponse.status}`);
      }
    } catch (error) {
      log(errorRecord(error, { callId }));
    }
  };
