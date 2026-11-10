import { existsSync, readFileSync } from "node:fs";
import * as tls from "node:tls";

/**
 * Returns a function that adds the egress CA at `path` to Node's default CAs the first time it finds the
 * file. The platform writes the file after the process may have started, so NODE_EXTRA_CA_CERTS, which
 * Node reads once at startup, can miss it.
 */
export const egressCaTrust = (path: string) => {
  let trusted = false;

  return () => {
    if (trusted || !existsSync(path)) {
      return;
    }

    tls.setDefaultCACertificates([...tls.getCACertificates("default"), readFileSync(path, "utf8")]);
    trusted = true;
  };
};
