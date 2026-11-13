import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const versionFile = fileURLToPath(new URL("../../../VERSION", import.meta.url));

const semver = /^\d+\.\d+\.\d+(-[\w.]+)?$/;

/** The version both plugins ship under: the root VERSION file, which the release step rewrites before it rebuilds. */
export const readVersion = (): string => {
  const version = readFileSync(versionFile, "utf8").trim();

  if (!semver.test(version)) {
    throw new Error(`VERSION must hold a semver string, got ${JSON.stringify(version)}`);
  }

  return version;
};
