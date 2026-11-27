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

const orEmpty = <Read>(
  bytes: Uint8Array | undefined,
  read: (bytes: Uint8Array) => Effect.Effect<Read, InvalidArchive>,
  empty: Read,
) => (bytes == null ? Effect.succeed(empty) : read(bytes));

const failureMessage = (result: Result.Result<unknown, InvalidArchive>) =>
  Result.isFailure(result) ? [result.failure.message] : [];

/**
 * The skills, agents and context of a create request, each decompressed once: the skills with their
 * files, the agents, and the context files. A kind the request did not carry reads as empty. Every
 * kind's archive is read to the end, so a request with several invalid archives gets one
 * InvalidArchive that carries every message, in the order of the kinds table. A kind added to the
 * table has no reader here until one is written, which fails to compile.
 */
export const readArchives = (request: Pick<CreateSession, ArchiveKind>) =>
  Effect.all(
    {
      skills: orEmpty(request.skills, readSkillsArchive, { skills: [], entries: [] }),
      agents: orEmpty(request.agents, readAgentsArchive, []),
      context: orEmpty(request.context, readContextArchive, []),
    } satisfies Record<ArchiveKind, Effect.Effect<unknown, InvalidArchive>>,
    { mode: "result", concurrency: "unbounded" },
  ).pipe(
    Effect.flatMap((results) => {
      const combined = Result.all(results);

      return Result.isSuccess(combined)
        ? Effect.succeed(combined.success)
        : Effect.fail(
            new InvalidArchive({
              message: Object.values(results).flatMap(failureMessage).join("\n"),
            }),
          );
    }),
  );
