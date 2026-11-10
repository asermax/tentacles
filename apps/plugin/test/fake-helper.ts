import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as Schema from "effect/Schema";

import {
  CommandResultJson,
  WatchLineJson,
  type CommandResult,
  type WatchLine,
} from "../src/core/helper-output.ts";

export interface FakeHelper {
  readonly path: string;
  /** Every argv the helper was run with, watch included. */
  readonly calls: () => ReadonlyArray<ReadonlyArray<string>>;
}

/**
 * An executable that stands in for the bundled helper: it prints the scripted
 * result per command and, for watch, the scripted lines, then stays up as the
 * real watch does.
 */
export const createFakeHelper = (
  results: Partial<Record<string, CommandResult>>,
  watchLines: ReadonlyArray<WatchLine> = [],
): FakeHelper => {
  const folder = mkdtempSync(join(tmpdir(), "tentacles-fake-helper-"));
  const path = join(folder, "tentacles-helper");
  const log = join(folder, "calls.log");

  const printed = Object.fromEntries(
    Object.entries(results).map(([name, result]) => [
      name,
      result == null ? "" : Schema.encodeSync(CommandResultJson)(result),
    ]),
  );

  const lines = watchLines.map((line) => Schema.encodeSync(WatchLineJson)(line));

  writeFileSync(
    path,
    [
      "#!/usr/bin/env node",
      'const { appendFileSync } = require("node:fs");',
      "const argv = process.argv.slice(2);",
      `appendFileSync(${JSON.stringify(log)}, JSON.stringify(argv) + "\\n");`,
      'if (argv[0] === "watch") {',
      `  for (const line of ${JSON.stringify(lines)}) console.log(line);`,
      "  setInterval(() => {}, 1000);",
      "} else {",
      `  console.log(${JSON.stringify(printed)}[argv[0]] ?? "");`,
      "}",
    ].join("\n"),
  );
  chmodSync(path, 0o755);

  return {
    path,
    calls: () => {
      const text = (() => {
        try {
          return readFileSync(log, "utf8");
        } catch {
          return "";
        }
      })();

      return text
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => Schema.decodeSync(Schema.fromJsonString(Schema.Array(Schema.String)))(line));
    },
  };
};

/** Polls until `check` holds or a second passes. */
export const eventually = async (check: () => boolean) => {
  for (let waited = 0; !check() && waited < 2000; waited += 20) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};
