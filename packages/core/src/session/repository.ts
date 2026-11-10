import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import type { ExecutionEnv } from "@earendil-works/pi-durable/env";
import { workspaceDirectory } from "@tentacles/contracts/workspace";
import * as Effect from "effect/Effect";

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

    return { output: output.trimEnd(), failed: !result.ok || result.value.exitCode !== 0 };
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
    const [status, unpushed] = yield* Effect.all(
      [
        run(env, ["git", "status", "--short"]),
        run(env, ["git", "log", "--branches", "--not", "--remotes", "--oneline"]),
      ],
      { concurrency: 2 },
    );

    if (status.failed || unpushed.failed) {
      return [status.output, unpushed.output].filter((text) => text !== "").join("\n");
    }

    const sections = [
      ...(status.output === "" ? [] : [status.output]),
      ...(unpushed.output === "" ? [] : [`Commits not pushed:\n${unpushed.output}`]),
    ];

    return sections.length === 0 ? null : sections.join("\n\n");
  });
