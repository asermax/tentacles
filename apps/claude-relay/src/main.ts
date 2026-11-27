import { setTimeout as sleep } from "node:timers/promises";

import { LogRecord, errorRecord, writeLog } from "./log";
import { createReportEnd } from "./report-end";
import { createRelay } from "./server";

const port = process.env.PORT;
const egressCaPath = process.env.EGRESS_CA_PATH;

if (port == null || egressCaPath == null) {
  throw new Error("PORT and EGRESS_CA_PATH must be set");
}

// The platform follows SIGTERM with SIGKILL, so the calls in flight get only this long to end.
const stopTimeoutMs = 5_000;

const relay = createRelay({ egressCaPath, reportEnd: createReportEnd(writeLog), log: writeLog });

// A failure outside a call is logged and the relay keeps running.
process.on("uncaughtException", (error) => writeLog(errorRecord(error)));

process.on("unhandledRejection", (reason) => writeLog(errorRecord(reason)));

let isShuttingDown = false;

const shutDown = async (signal: NodeJS.Signals) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  writeLog(LogRecord.cases.RelaySignal.make({ signal }));

  await Promise.race([relay.stop(), sleep(stopTimeoutMs)]);

  relay.server.close();
  writeLog(LogRecord.cases.RelayExit.make({}));
  process.exit(0);
};

process.on("SIGTERM", (signal) => void shutDown(signal));

process.on("SIGINT", (signal) => void shutDown(signal));

relay.server.listen(Number(port), () =>
  writeLog(LogRecord.cases.RelayStart.make({ port: Number(port) })),
);
