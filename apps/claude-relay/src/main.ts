import { relayServer } from "./server";

const port = process.env.PORT;
const egressCaPath = process.env.EGRESS_CA_PATH;

if (port == null || egressCaPath == null) {
  throw new Error("PORT and EGRESS_CA_PATH must be set");
}

relayServer(egressCaPath).listen(Number(port), () =>
  console.log(`claude relay listening on ${port}`),
);
