import { LogRecord, writeLog } from "./log";
import { createReportEnd } from "./report-end";
import { createRelay } from "./server";

const port = process.env.PORT;
const egressCaPath = process.env.EGRESS_CA_PATH;

if (port == null || egressCaPath == null) {
  throw new Error("PORT and EGRESS_CA_PATH must be set");
}

const relay = createRelay({ egressCaPath, reportEnd: createReportEnd(writeLog), log: writeLog });

relay.server.listen(Number(port), () =>
  writeLog(LogRecord.cases.RelayStart.make({ port: Number(port) })),
);
