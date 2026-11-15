import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import type { ExecutionEnv } from "@earendil-works/pi-durable/env";
import { workspaceDirectory } from "@tentacles/contracts/workspace";
import { RepositoryCheck } from "@tentacles/worker-api/session-state";
import type { Repository } from "@tentacles/worker-api/settings";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

/** The work git reports. The question tool refuses on it, so no question carries it. */
export const Pending = Schema.TaggedStruct("Pending", { status: Schema.String });

export type Pending = typeof Pending.Type;

/** What `checkRepository` finds: the outcomes the wire carries, plus the pending work that makes the question tool refuse. */
export const RepositoryCheckResult = Schema.Union([...RepositoryCheck.members, Pending]).pipe(
  Schema.toTaggedUnion("_tag"),
);

export type RepositoryCheckResult = typeof RepositoryCheckResult.Type;

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

// `git status --short` shows only the working tree, so the commits no remote has are listed after it.
const pendingWork = (env: ExecutionEnv) =>
  Effect.gen(function* () {
    const [status, unpushed] = yield* Effect.all(
      [
        run(env, ["git", "status", "--short"]),
        run(env, ["git", "log", "--branches", "--not", "--remotes", "--oneline"]),
      ],
      { concurrency: 2 },
    );

    if (status.failed || unpushed.failed) {
      return RepositoryCheck.cases.CheckFailed.make({
        output: [status.output, unpushed.output].filter((text) => text !== "").join("\n"),
      });
    }

    const sections = [
      ...(status.output === "" ? [] : [status.output]),
      ...(unpushed.output === "" ? [] : [`Commits not pushed:\n${unpushed.output}`]),
    ];

    return sections.length === 0
      ? RepositoryCheck.cases.Clean.make({})
      : Pending.make({ status: sections.join("\n\n") });
  });

/**
 * Whether the session's managed repository holds work that is not committed
 * and pushed. A stopped container is reported as such and never started: the
 * workspace keeps itself up while it has pending work, so a stopped one had
 * none, and the env would start it and clone just to find nothing.
 */
export const checkRepository = (
  repository: Repository | null,
  env: ExecutionEnv | undefined,
  isRunning: Effect.Effect<boolean>,
): Effect.Effect<RepositoryCheckResult> =>
  Effect.gen(function* () {
    if (repository == null) {
      return RepositoryCheck.cases.NoRepository.make({});
    }

    if (env == null || !(yield* isRunning)) {
      return RepositoryCheck.cases.Stopped.make({});
    }

    return yield* pendingWork(env);
  });
