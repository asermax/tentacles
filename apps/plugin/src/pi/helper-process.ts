import { execFile, spawn } from "node:child_process";

import type { SessionId } from "@tentacles/worker-api/ids";

import type { WatchProcess } from "../core/glue";
import { HelperPathVariable } from "../core/helper-path-variable";

// The helper lives at the package root, one level above the bundled
// extension; TENTACLES_HELPER points elsewhere when set.
export const helperPath = () =>
  process.env[HelperPathVariable] ?? new URL("../tentacles-helper", import.meta.url).pathname;

/** Runs one helper command; its result line is on stdout even when the command fails. */
export const runHelperProcess = (argv: ReadonlyArray<string>) =>
  new Promise<string>((resolve) => {
    execFile(helperPath(), [...argv], { maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
      resolve(stdout === "" && error != null ? error.message : stdout);
    });
  });

export const startWatchProcess = (
  sessionIds: ReadonlyArray<SessionId>,
  onOutput: (chunk: string) => void,
): WatchProcess => {
  const child = spawn(helperPath(), ["watch", ...sessionIds], {
    stdio: ["ignore", "pipe", "ignore"],
  });

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", onOutput);
  child.on("error", () => undefined);

  return { stop: () => child.kill() };
};
