import { setTimeout as sleep } from "node:timers/promises";

import * as Schema from "effect/Schema";

import { LogRecord, errorRecord, writeLog } from "./log";
import { createReportEnd } from "./report-end";
import { createRelay } from "./server";

const port = process.env.PORT;
const egressCaPath = process.env.EGRESS_CA_PATH;

if (port == null || egressCaPath == null) {
  throw new Error("PORT and EGRESS_CA_PATH must be set");
}

const listenPort = Schema.decodeSync(Schema.NumberFromString.check(Schema.isInt()))(port);

// The platform follows SIGTERM with SIGKILL up to 15 minutes later. The relay does not wait that long for the calls in flight to end; it ends them after this long.
const stopTimeoutMs = 5_000;

const relay = createRelay({ egressCaPath, reportEnd: createReportEnd(writeLog), log: writeLog });

// A failure outside a call is logged and the relay keeps running.
process.on("uncaughtException", (error) => writeLog(errorRecord(error)));

process.on("unhandledRejection", (reason) => writeLog(errorRecord(reason)));

const shutDown = async (signal: NodeJS.Signals) => {
  writeLog(LogRecord.cases.RelaySignal.make({ signal }));

  if (relay.isStopping()) {
    return;
  }

  await Promise.race([relay.stop(), sleep(stopTimeoutMs)]);

  relay.server.close();
  writeLog(LogRecord.cases.RelayExit.make({}));
  process.exit(0);
};

process.on("SIGTERM", (signal) => void shutDown(signal));

process.on("SIGINT", (signal) => void shutDown(signal));

relay.server.listen(listenPort, () =>
  writeLog(LogRecord.cases.RelayStart.make({ port: listenPort })),
);
