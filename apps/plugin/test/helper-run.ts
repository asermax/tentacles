import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import type * as Schema from "effect/Schema";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import type { SessionId } from "@tentacles/worker-api/ids";
import { vi } from "vitest";

import type { CommandResult, WatchLine } from "../src/core/helper-output.ts";
import { runCommand, type CommandName } from "../src/helper/command.ts";
import { NodeWebSocketConstructor } from "../src/helper/client.ts";
import { watchSessions } from "../src/helper/watch.ts";
import { stubApiKey } from "./stub-worker.ts";

export type Variables = Record<string, string>;

export const variablesFor = (url: string, extra: Variables = {}) => ({
  TENTACLES_URL: url,
  TENTACLES_API_KEY: stubApiKey,
  ...extra,
});

/** Runs one helper command in-process with these variables as its environment. */
export const runHelperCommand = (
  name: CommandName,
  args: Schema.JsonObject,
  variables: Variables,
): Promise<CommandResult> =>
  Effect.runPromise(
    runCommand(name, JSON.stringify(args)).pipe(
      Effect.provide([
        FetchHttpClient.layer,
        ConfigProvider.layer(ConfigProvider.fromEnvRecord(variables)),
      ]),
    ),
  );

/** Runs the helper's watch until `until` holds for the lines printed so far, then stops it. */
export const runHelperWatch = async (
  sessionIds: ReadonlyArray<SessionId>,
  variables: Variables,
  until: (lines: ReadonlyArray<WatchLine>) => boolean,
): Promise<ReadonlyArray<WatchLine>> => {
  const lines: Array<WatchLine> = [];

  const fiber = Effect.runFork(
    watchSessions(sessionIds, (line) => Effect.sync(() => lines.push(line))).pipe(
      Effect.provide([
        FetchHttpClient.layer,
        NodeWebSocketConstructor,
        ConfigProvider.layer(ConfigProvider.fromEnvRecord(variables)),
      ]),
    ),
  );

  // A timeout still returns the lines that arrived, so the test's assertion on
  // them shows which ones are missing.
  await vi
    .waitFor(
      () => {
        if (!until(lines)) {
          throw new Error("The watch has not printed the lines yet");
        }
      },
      { timeout: 5000, interval: 20 },
    )
    .catch(() => undefined);

  await Effect.runPromise(Fiber.interrupt(fiber));

  return lines;
};
