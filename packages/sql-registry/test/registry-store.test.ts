import { describe, expect, it } from "@effect/vitest";
import { PreviewToken } from "@tentacles/contracts/preview-router";
import { RegistryStore, RegistryUnavailable } from "@tentacles/contracts/registry-store";
import { ParentSessionId, SessionId } from "@tentacles/worker-api/ids";
import { Harnesses, type Parent } from "@tentacles/worker-api/parent";
import {
  SessionStatuses,
  type SessionDetails,
  type SessionStatus,
} from "@tentacles/worker-api/session-state";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { TestClock } from "effect/testing";

import { closedRegistry, freshRegistry } from "./fresh-registry.ts";

const day = 86_400_000;
const now = Date.UTC(2026, 10, 10, 12);
const farFuture = Date.UTC(2100, 0, 1);

const sessionId = (index: number) =>
  Schema.decodeSync(SessionId)(`00000000-0000-4000-8000-${String(index).padStart(12, "0")}`);

const parentOf = (harness: Parent["harness"], id: string): Parent => ({
  harness,
  sessionId: Schema.decodeSync(ParentSessionId)(id),
});

const parent = parentOf(Harnesses.pi, "parent-session");

const unknownToken = Schema.decodeSync(PreviewToken)("9b2f6c1e-3d4a-4f5b-8c7d-0e1f2a3b4c5d");

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const settings: SessionDetails["settings"] = {
  provider: "anthropic",
  model: "claude-opus-5-5",
  effort: "high",
  image: "default",
  size: "standard",
  lifetime: 3600,
  repository: { url: "https://github.com/acme/app", shallow: true },
};

const noDetails: SessionDetails = { settings, skills: [], agents: [] };

const named: SessionDetails = {
  settings,
  skills: ["implement", "review"],
  agents: ["reviewer"],
};

const running = (id: SessionId, name = "worker") =>
  Effect.gen(function* () {
    const registry = yield* RegistryStore;

    yield* registry.add(id, name, parent, noDetails);
    yield* registry.setStatus(id, SessionStatuses.running);
  });

const stoppedAt = (id: SessionId, status: SessionStatus, at: number) =>
  Effect.gen(function* () {
    yield* TestClock.setTime(at);
    yield* running(id);
    yield* (yield* RegistryStore).setStatus(id, status);
  });

describe("RegistryStore over SQLite", () => {
  it.effect(
    "lists an added entry with its name and details once its first status is recorded",
    () =>
      Effect.gen(function* () {
        const registry = yield* RegistryStore;
        const id = sessionId(1);

        yield* registry.add(id, "fix the build", parent, named);
        yield* registry.setStatus(id, SessionStatuses.running);

        expect(yield* registry.list(parent)).toEqual([
          { sessionId: id, name: "fix the build", status: SessionStatuses.running, ...named },
        ]);
      }).pipe(Effect.provide(freshRegistry)),
  );

  it.effect("lists an entry added without skills or agents with the settings and empty lists", () =>
    Effect.gen(function* () {
      const registry = yield* RegistryStore;
      const id = sessionId(1);

      yield* registry.add(id, "plain", parent, noDetails);
      yield* registry.setStatus(id, SessionStatuses.running);

      expect(yield* registry.list(parent)).toEqual([
        { sessionId: id, name: "plain", status: SessionStatuses.running, ...noDetails },
      ]);
    }).pipe(Effect.provide(freshRegistry)),
  );

  it.effect(
    "lists only one parent's entries, closed ones included, apart from the other harness",
    () =>
      Effect.gen(function* () {
        const registry = yield* RegistryStore;
        const otherHarness = parentOf(Harnesses.claude, "parent-session");

        yield* running(sessionId(1));
        yield* running(sessionId(2));
        yield* registry.setStatus(sessionId(2), SessionStatuses.closed);
        yield* registry.add(sessionId(3), "elsewhere", otherHarness, noDetails);
        yield* registry.setStatus(sessionId(3), SessionStatuses.running);

        const listed = yield* registry.list(parent);

        expect(listed.toSorted((a, b) => a.sessionId.localeCompare(b.sessionId))).toEqual([
          {
            sessionId: sessionId(1),
            name: "worker",
            status: SessionStatuses.running,
            ...noDetails,
          },
          { sessionId: sessionId(2), name: "worker", status: SessionStatuses.closed, ...noDetails },
        ]);
      }).pipe(Effect.provide(freshRegistry)),
  );

  it.effect("records running as the first status with no stop time", () =>
    Effect.gen(function* () {
      const registry = yield* RegistryStore;

      yield* running(sessionId(1));

      expect((yield* registry.list(parent))[0]?.status).toBe(SessionStatuses.running);
      expect(yield* registry.stoppedBefore(farFuture)).toEqual([]);
    }).pipe(Effect.provide(freshRegistry)),
  );

  describe.each([SessionStatuses.idle, SessionStatuses.failed, SessionStatuses.closed])(
    "a run that stops as %s",
    (status) => {
      it.effect("sets the stop time to now and clears the preview", () =>
        Effect.gen(function* () {
          const registry = yield* RegistryStore;
          const id = sessionId(1);

          yield* TestClock.setTime(now - day);
          yield* running(id);

          const { token } = yield* registry.openPreview(id, 3000);

          yield* TestClock.setTime(now);
          yield* registry.setStatus(id, status);

          expect((yield* registry.list(parent))[0]?.status).toBe(status);
          expect(yield* registry.stoppedBefore(now)).toEqual([]);
          expect(yield* registry.stoppedBefore(now + 1)).toEqual([id]);
          expect(yield* registry.resolvePreview(token)).toBeNull();
        }).pipe(Effect.provide(freshRegistry)),
      );
    },
  );

  it.effect("clears the stop time when a new run starts, so cleanup no longer picks it", () =>
    Effect.gen(function* () {
      const registry = yield* RegistryStore;
      const id = sessionId(1);

      yield* stoppedAt(id, SessionStatuses.idle, now - 60 * day);
      yield* TestClock.setTime(now);
      yield* registry.setStatus(id, SessionStatuses.running);

      expect((yield* registry.list(parent))[0]?.status).toBe(SessionStatuses.running);
      expect(yield* registry.stoppedBefore(farFuture)).toEqual([]);
    }).pipe(Effect.provide(freshRegistry)),
  );

  it.effect("keeps the preview open and sets no stop time while a question waits", () =>
    Effect.gen(function* () {
      const registry = yield* RegistryStore;
      const id = sessionId(1);

      yield* running(id);

      const { token } = yield* registry.openPreview(id, 3000);

      yield* registry.setStatus(id, SessionStatuses.waiting);

      expect((yield* registry.list(parent))[0]?.status).toBe(SessionStatuses.waiting);
      expect(yield* registry.stoppedBefore(farFuture)).toEqual([]);
      expect(yield* registry.resolvePreview(token)).toEqual({ sessionId: id, port: 3000 });
    }).pipe(Effect.provide(freshRegistry)),
  );

  it.effect("keeps the time the run stopped when an idle session closes", () =>
    Effect.gen(function* () {
      const registry = yield* RegistryStore;
      const id = sessionId(1);
      const stopped = now - 14 * day;

      yield* stoppedAt(id, SessionStatuses.idle, stopped);
      yield* TestClock.setTime(now);
      yield* registry.setStatus(id, SessionStatuses.closed);

      expect((yield* registry.list(parent))[0]?.status).toBe(SessionStatuses.closed);
      expect(yield* registry.stoppedBefore(stopped)).toEqual([]);
      expect(yield* registry.stoppedBefore(stopped + 1)).toEqual([id]);
    }).pipe(Effect.provide(freshRegistry)),
  );

  it.effect("opens a first preview with a fresh token that resolves to the session and port", () =>
    Effect.gen(function* () {
      const registry = yield* RegistryStore;
      const id = sessionId(1);

      yield* running(id);

      const opened = yield* registry.openPreview(id, 3000);

      expect(opened.token).toMatch(uuidPattern);
      expect(yield* registry.resolvePreview(opened.token)).toEqual({ sessionId: id, port: 3000 });
    }).pipe(Effect.provide(freshRegistry)),
  );

  it.effect("replaces an open preview, so only the new token resolves", () =>
    Effect.gen(function* () {
      const registry = yield* RegistryStore;
      const id = sessionId(1);

      yield* running(id);

      const first = yield* registry.openPreview(id, 3000);
      const second = yield* registry.openPreview(id, 5173);

      expect(second.token).not.toBe(first.token);
      expect(yield* registry.resolvePreview(first.token)).toBeNull();
      expect(yield* registry.resolvePreview(second.token)).toEqual({ sessionId: id, port: 5173 });
    }).pipe(Effect.provide(freshRegistry)),
  );

  it.effect("fails with RegistryUnavailable when the database throws", () =>
    Effect.gen(function* () {
      const registry = yield* RegistryStore;

      expect(yield* registry.openPreview(sessionId(1), 3000).pipe(Effect.flip)).toBeInstanceOf(
        RegistryUnavailable,
      );
      expect(yield* registry.stoppedBefore(now).pipe(Effect.flip)).toBeInstanceOf(
        RegistryUnavailable,
      );
    }).pipe(Effect.provide(closedRegistry)),
  );

  it.effect("resolves an unknown token to nothing", () =>
    Effect.gen(function* () {
      const registry = yield* RegistryStore;

      expect(yield* registry.resolvePreview(unknownToken)).toBeNull();
    }).pipe(Effect.provide(freshRegistry)),
  );

  it.effect("picks as cleanup candidates only the entries stopped before the cutoff", () =>
    Effect.gen(function* () {
      const registry = yield* RegistryStore;
      const cutoff = now - 30 * day;

      yield* stoppedAt(sessionId(1), SessionStatuses.idle, cutoff - 10 * day);
      yield* stoppedAt(sessionId(2), SessionStatuses.failed, cutoff - 5 * day);
      yield* stoppedAt(sessionId(3), SessionStatuses.closed, cutoff - 1);
      yield* stoppedAt(sessionId(4), SessionStatuses.idle, cutoff + 10 * day);
      yield* TestClock.setTime(cutoff - 20 * day);
      yield* running(sessionId(5));
      yield* running(sessionId(6));
      yield* registry.setStatus(sessionId(6), SessionStatuses.waiting);
      yield* registry.add(sessionId(7), "never reported", parent, noDetails);

      const candidates = yield* registry.stoppedBefore(cutoff);

      expect(candidates.toSorted((a, b) => a.localeCompare(b))).toEqual([
        sessionId(1),
        sessionId(2),
        sessionId(3),
      ]);
    }).pipe(Effect.provide(freshRegistry)),
  );

  it.effect(
    "removes an entry, so it is no longer listed and its old token resolves to nothing",
    () =>
      Effect.gen(function* () {
        const registry = yield* RegistryStore;
        const id = sessionId(1);

        yield* running(id);

        const { token } = yield* registry.openPreview(id, 3000);

        yield* registry.setStatus(id, SessionStatuses.idle);
        yield* registry.remove(id);

        expect(yield* registry.list(parent)).toEqual([]);
        expect(yield* registry.resolvePreview(token)).toBeNull();
      }).pipe(Effect.provide(freshRegistry)),
  );
});
