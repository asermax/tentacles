import { archiveKinds, type ArchiveKind } from "@tentacles/worker-api/archive-kinds";
import {
  readAgentsArchive,
  readContextArchive,
  readSkillsArchive,
} from "@tentacles/worker-api/archives";
import { InvalidArchive } from "@tentacles/worker-api/errors";
import type { CreateSession } from "@tentacles/worker-api/sessions";
import * as Effect from "effect/Effect";
import * as Record from "effect/Record";
import * as Result from "effect/Result";
import * as Struct from "effect/Struct";

// A kind added to the table has no reader here until one is written, which fails to compile.
const archiveReaders = {
  skills: readSkillsArchive,
  agents: readAgentsArchive,
  context: readContextArchive,
} satisfies Record<ArchiveKind, (bytes: Uint8Array) => Effect.Effect<unknown, InvalidArchive>>;

/** A reader that answers an empty read for a kind the request did not carry. */
interface OrEmpty extends Struct.Lambda {
  <Read>(
    read: (bytes: Uint8Array) => Effect.Effect<Read, InvalidArchive>,
  ): (bytes: Uint8Array | undefined) => Effect.Effect<Read | never[], InvalidArchive>;
  readonly "~lambda.out": this["~lambda.in"] extends (
    bytes: Uint8Array,
  ) => Effect.Effect<infer Read, InvalidArchive>
    ? (bytes: Uint8Array | undefined) => Effect.Effect<Read | never[], InvalidArchive>
    : never;
}

const orEmpty = Struct.lambda<OrEmpty>(
  (read) => (bytes) => (bytes == null ? Effect.succeed([]) : read(bytes)),
);

const failureMessage = (result: Result.Result<unknown, InvalidArchive>) =>
  Result.isFailure(result) ? [result.failure.message] : [];

/**
 * The skills, agents and context of a create request. Every kind's archive is read to the end, so
 * a request with several invalid archives gets one InvalidArchive that carries every message, in
 * the order of the kinds table.
 */
export const readArchives = (request: Pick<CreateSession, ArchiveKind>) =>
  Effect.all(
    Struct.evolve(
      Record.map(archiveKinds, (_, kind) => request[kind]),
      Struct.map(archiveReaders, orEmpty),
    ),
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
