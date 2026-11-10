import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import type { ExecutionEnv } from "@earendil-works/pi-durable/env";
import * as Effect from "effect/Effect";

import { workspaceDirectory } from "./workspace-directory.ts";

const run = (env: ExecutionEnv, command: readonly string[]) =>
  Effect.promise(async () => {
    let output = "";

    const result = await env.exec(
      command,
      {
        cwd: workspaceDirectory,
        onOutput: (text) => {
          output += text;
        },
      },
      BACKGROUND_CONTEXT,
    );

    return { output: output.trim(), failed: !result.ok || result.value.exitCode !== 0 };
  });

/**
 * What the managed repository holds that is not committed and pushed, as the
 * agent should read it, or null when nothing is. `git status --short` shows
 * only the working tree, so the commits no remote has are listed after it. A
 * repository git cannot read counts as pending, since nothing shows its work
 * is pushed.
 */
export const pendingWork = (env: ExecutionEnv) =>
  Effect.gen(function* () {
    const status = yield* run(env, ["git", "status", "--short"]);

    const unpushed = yield* run(env, [
      "git",
      "log",
      "--branches",
      "--not",
      "--remotes",
      "--oneline",
    ]);

    if (status.failed || unpushed.failed) {
      return [status.output, unpushed.output].filter((text) => text !== "").join("\n");
    }

    const sections = [
      ...(status.output === "" ? [] : [status.output]),
      ...(unpushed.output === "" ? [] : [`Commits not pushed:\n${unpushed.output}`]),
    ];

    return sections.length === 0 ? null : sections.join("\n\n");
  });
