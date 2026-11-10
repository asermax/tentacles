import { PreviewToken } from "@tentacles/contracts/preview-router";
import { RegistryStore } from "@tentacles/contracts/registry-store";
import { SessionId } from "@tentacles/worker-api/ids";
import type { Parent } from "@tentacles/worker-api/parent";
import {
  SessionRef,
  SessionStatuses,
  type SessionStatus,
} from "@tentacles/worker-api/session-state";
import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import * as Clock from "effect/Clock";
import { SecureRandom } from "effect/crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { registry } from "./schema.ts";

/** A synchronous drizzle SQLite database: a Durable Object's storage, or better-sqlite3 in tests. */
export type RegistryDatabase = BaseSQLiteDatabase<"sync", unknown>;

const stopped = [SessionStatuses.idle, SessionStatuses.failed, SessionStatuses.closed];

const decodeRefs = Schema.decodeUnknownEffect(Schema.Array(SessionRef));

const decodeTarget = Schema.decodeUnknownEffect(
  Schema.NullOr(Schema.Struct({ sessionId: SessionId, port: Schema.Int })),
);

const decodeSessionIds = Schema.decodeUnknownEffect(Schema.Array(SessionId));

const decodeToken = Schema.decodeUnknownEffect(PreviewToken);

const decodeReplaced = Schema.decodeUnknownEffect(Schema.NullOr(PreviewToken));

// The columns a status change writes. A stop that follows a run sets
// lastStopped; a stop that follows a stop (idle or failed, then closed) keeps
// it, which the update reads from the row's current status in the same
// statement.
const changesFor = (status: SessionStatus, now: number) => {
  switch (status) {
    case SessionStatuses.running:
      return { status, lastStopped: null };
    case SessionStatuses.waiting:
      return { status };
    case SessionStatuses.idle:
    case SessionStatuses.failed:
    case SessionStatuses.closed:
      return {
        status,
        lastStopped: sql`case when ${inArray(registry.status, stopped)} then ${registry.lastStopped} else ${now} end`,
        previewPort: null,
        previewToken: null,
      };
    default: {
      const exhaustive: never = status;

      return exhaustive;
    }
  }
};

const ofParent = (parent: Parent) =>
  and(eq(registry.parentHarness, parent.harness), eq(registry.parentSessionId, parent.sessionId));

/** RegistryStore over a drizzle SQLite database migrated with this package's migrations. */
export const sqlRegistryStore = (db: RegistryDatabase) =>
  Layer.effect(
    RegistryStore,
    Effect.gen(function* () {
      const random = yield* SecureRandom.SecureRandom;

      return RegistryStore.of({
        add: (sessionId, name, parent) =>
          Effect.sync(() => {
            db.insert(registry)
              .values({
                sessionId,
                name,
                parentHarness: parent.harness,
                parentSessionId: parent.sessionId,
              })
              .run();
          }),

        setStatus: (sessionId, status) =>
          Effect.flatMap(Clock.currentTimeMillis, (now) =>
            Effect.sync(() => {
              db.update(registry)
                .set(changesFor(status, now))
                .where(eq(registry.sessionId, sessionId))
                .run();
            }),
          ),

        // An entry with no status yet is left out: a parent lists only after
        // create answered, which waits for the first status.
        list: (parent) =>
          Effect.sync(() =>
            db
              .select({
                sessionId: registry.sessionId,
                name: registry.name,
                status: registry.status,
              })
              .from(registry)
              .where(and(ofParent(parent), isNotNull(registry.status)))
              .all(),
          ).pipe(Effect.flatMap(decodeRefs), Effect.orDie),

        remove: (sessionId) =>
          Effect.sync(() => {
            db.delete(registry).where(eq(registry.sessionId, sessionId)).run();
          }),

        openPreview: (sessionId, port) =>
          Effect.gen(function* () {
            const token = yield* random.uuidV4().pipe(Effect.flatMap(decodeToken), Effect.orDie);

            // Read and write in one synchronous block, so no other call runs
            // between the two.
            const previous = yield* Effect.sync(() => {
              const row = db
                .select({ previewToken: registry.previewToken })
                .from(registry)
                .where(eq(registry.sessionId, sessionId))
                .get();

              db.update(registry)
                .set({ previewPort: port, previewToken: token })
                .where(eq(registry.sessionId, sessionId))
                .run();

              return row?.previewToken ?? null;
            });

            const replaced = yield* decodeReplaced(previous).pipe(Effect.orDie);

            return { token, replaced };
          }),

        resolvePreview: (token) =>
          Effect.sync(
            () =>
              db
                .select({ sessionId: registry.sessionId, port: registry.previewPort })
                .from(registry)
                .where(eq(registry.previewToken, token))
                .get() ?? null,
          ).pipe(Effect.flatMap(decodeTarget), Effect.orDie),

        closePreview: (sessionId) =>
          Effect.sync(() => {
            db.update(registry)
              .set({ previewPort: null, previewToken: null })
              .where(eq(registry.sessionId, sessionId))
              .run();
          }),

        stoppedBefore: (before) =>
          Effect.sync(() =>
            db
              .select({ sessionId: registry.sessionId })
              .from(registry)
              .where(lt(registry.lastStopped, before))
              .all()
              .map((row) => row.sessionId),
          ).pipe(Effect.flatMap(decodeSessionIds), Effect.orDie),
      });
    }),
  ).pipe(Layer.provide(SecureRandom.layerWebCrypto));
