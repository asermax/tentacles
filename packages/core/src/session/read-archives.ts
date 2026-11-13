import { readAgentsArchive, readSkillsArchive } from "@tentacles/worker-api/archives";
import { InvalidArchive } from "@tentacles/worker-api/errors";
import type { CreateSession } from "@tentacles/worker-api/sessions";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

/**
 * The skills and agents of a create request. Both archives are read to the end, so a request with
 * two invalid archives gets one InvalidArchive that carries both problems.
 */
export const readArchives = ({ skills, agents }: Pick<CreateSession, "skills" | "agents">) =>
  Effect.all(
    [
      Effect.result(skills == null ? Effect.succeed([]) : readSkillsArchive(skills)),
      Effect.result(agents == null ? Effect.succeed([]) : readAgentsArchive(agents)),
    ],
    { concurrency: "unbounded" },
  ).pipe(
    Effect.flatMap(([skillsResult, agentsResult]) => {
      if (Result.isSuccess(skillsResult) && Result.isSuccess(agentsResult)) {
        return Effect.succeed({ skills: skillsResult.success, agents: agentsResult.success });
      }

      const messages = [skillsResult, agentsResult].flatMap((result) =>
        Result.isFailure(result) ? [result.failure.message] : [],
      );

      return Effect.fail(new InvalidArchive({ message: messages.join("\n") }));
    }),
  );
