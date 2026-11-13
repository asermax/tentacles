import {
  readAgentsArchive,
  readContextArchive,
  readSkillsArchive,
} from "@tentacles/worker-api/archives";
import { InvalidArchive } from "@tentacles/worker-api/errors";
import type { CreateSession } from "@tentacles/worker-api/sessions";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

/**
 * The skills, agents and context of a create request. All three archives are read to the end, so
 * a request with several invalid archives gets one InvalidArchive that carries every problem.
 * `context` tells whether the request carried a readable context archive.
 */
export const readArchives = ({
  skills,
  agents,
  context,
}: Pick<CreateSession, "skills" | "agents" | "context">) =>
  Effect.all(
    [
      Effect.result(skills == null ? Effect.succeed([]) : readSkillsArchive(skills)),
      Effect.result(agents == null ? Effect.succeed([]) : readAgentsArchive(agents)),
      Effect.result(context == null ? Effect.succeed([]) : readContextArchive(context)),
    ],
    { concurrency: "unbounded" },
  ).pipe(
    Effect.flatMap(([skillsResult, agentsResult, contextResult]) => {
      if (
        Result.isSuccess(skillsResult) &&
        Result.isSuccess(agentsResult) &&
        Result.isSuccess(contextResult)
      ) {
        return Effect.succeed({
          skills: skillsResult.success,
          agents: agentsResult.success,
          context: context != null,
        });
      }

      const messages = [
        ...(Result.isFailure(skillsResult) ? [skillsResult.failure.message] : []),
        ...(Result.isFailure(agentsResult) ? [agentsResult.failure.message] : []),
        ...(Result.isFailure(contextResult) ? [contextResult.failure.message] : []),
      ];

      return Effect.fail(new InvalidArchive({ message: messages.join("\n") }));
    }),
  );
