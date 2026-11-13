import type { ArchiveKind } from "@tentacles/worker-api/archive-kinds";
import {
  readAgentsArchive,
  readContextArchive,
  readSkillsArchive,
} from "@tentacles/worker-api/archives";
import { InvalidArchive } from "@tentacles/worker-api/errors";
import type { CreateSession } from "@tentacles/worker-api/sessions";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

const failureMessage = (result: Result.Result<unknown, InvalidArchive>) =>
  Result.isFailure(result) ? [result.failure.message] : [];

/**
 * The skills, agents and context of a create request. Every kind's archive is read to the end, so
 * a request with several invalid archives gets one InvalidArchive that carries every message, in
 * the order of the kinds table.
 */
export const readArchives = (request: Pick<CreateSession, ArchiveKind>) =>
  Effect.all(
    {
      skills: Effect.result(
        request.skills == null ? Effect.succeed([]) : readSkillsArchive(request.skills),
      ),
      agents: Effect.result(
        request.agents == null ? Effect.succeed([]) : readAgentsArchive(request.agents),
      ),
      context: Effect.result(
        request.context == null ? Effect.succeed([]) : readContextArchive(request.context),
      ),
    },
    { concurrency: "unbounded" },
  ).pipe(
    Effect.flatMap(({ skills, agents, context }) =>
      Result.isSuccess(skills) && Result.isSuccess(agents) && Result.isSuccess(context)
        ? Effect.succeed({
            skills: skills.success,
            agents: agents.success,
            context: context.success,
          })
        : Effect.fail(
            new InvalidArchive({
              message: [skills, agents, context].flatMap(failureMessage).join("\n"),
            }),
          ),
    ),
  );
