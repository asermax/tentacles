import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import {
  type Harness,
  LiveDoc,
  type LiveState,
  type Observation,
  type Observer,
  ROOT_CONVERSATION_ID,
} from "@earendil-works/pi-durable";
import { Browser } from "@tentacles/contracts/browser";
import { ParentChannel } from "@tentacles/contracts/parent-channel";
import { RegistryStore } from "@tentacles/contracts/registry-store";
import type { Entry } from "@tentacles/worker-api/entries";
import type { SessionId } from "@tentacles/worker-api/ids";
import type { Parent } from "@tentacles/worker-api/parent";
import {
  isActive,
  type SessionDetails,
  SessionState,
  statusOf,
} from "@tentacles/worker-api/session-state";
import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";

import { AgentsDoc } from "../tools/agents-doc.ts";
import { SkillsDoc } from "../tools/skills.ts";
import { toEntries } from "./entries.ts";
import { QuestionsDoc, type StoredQuestion } from "./questions.ts";
import { RecordDoc, type SessionRecord } from "./record.ts";

/** What the status is derived from: the session's documents as last observed. */
export type Observed = {
  live: LiveState | undefined;
  questions: readonly StoredQuestion[];
  record: SessionRecord | undefined;
  names: Pick<SessionDetails, "skills" | "agents">;
};

const describeFailure = (failure: NonNullable<LiveState["runFailure"]>) =>
  failure.detail == null ? failure.reason : `${failure.reason}: ${failure.detail}`;

const liveQuestions = (observed: Observed) => {
  const calls = new Set((observed.live?.tools ?? []).map((slot) => String(slot.taskId)));

  return observed.questions.filter((question) => calls.has(question.id));
};

// A question waits while it has no answer and the tool call that asked it is
// still in pi.live: an aborted or finished call takes its question with it.
const waitingQuestion = (observed: Observed) =>
  liveQuestions(observed).find((question) => question.answer == null);

/** The session's state as its documents show it; null before create stored the record. */
export const deriveState = (observed: Observed): SessionState | null => {
  if (observed.record == null) {
    return null;
  }

  const details: SessionDetails = { settings: observed.record.settings, ...observed.names };

  if (observed.live?.run != null) {
    const question = waitingQuestion(observed);

    return question == null
      ? SessionState.cases.running.make(details)
      : SessionState.cases.waiting.make({
          ...details,
          question: { id: question.id, text: question.text },
        });
  }

  if (observed.record.closed) {
    return SessionState.cases.closed.make(details);
  }

  const failure = observed.live?.runFailure;

  return failure == null
    ? SessionState.cases.idle.make(details)
    : SessionState.cases.failed.make({ ...details, failure: describeFailure(failure) });
};

// Two states are the same change when their status is, and, while waiting,
// their question too.
const changeKey = (state: SessionState) =>
  SessionState.guards.waiting(state) ? `waiting ${state.question.id}` : statusOf(state);

const readObserved = (harness: Harness, sessionId: SessionId) =>
  Effect.promise(async (): Promise<Omit<Observed, "names">> => {
    const [live, questions, record] = await Promise.all([
      harness.snapshot(LiveDoc, ROOT_CONVERSATION_ID, BACKGROUND_CONTEXT),
      harness.snapshot(QuestionsDoc, BACKGROUND_CONTEXT),
      harness.snapshot(RecordDoc, sessionId, BACKGROUND_CONTEXT),
    ]);

    return { live, questions: questions?.questions ?? [], record };
  });

const lastEntry = (harness: Harness) =>
  Effect.promise(async (): Promise<Entry | undefined> => {
    const root = await harness.root(BACKGROUND_CONTEXT);
    const page = await root.entries({ order: "descending" }, 10, undefined, BACKGROUND_CONTEXT);

    return page.items.toReversed().flatMap(toEntries).at(-1);
  });

/**
 * The session's status, derived from what it observes in pi-durable and
 * reported to the registry and the parent on every change. The registry's only
 * writer.
 */
export const trackStatus = (harness: Harness, sessionId: SessionId) =>
  Effect.gen(function* () {
    const registry = yield* RegistryStore;
    const channel = yield* ParentChannel;
    const browser = yield* Browser;
    const scope = yield* Scope.Scope;
    const services = yield* Effect.context();
    const reporting = yield* Semaphore.make(1);
    const reported = yield* Deferred.make<void>();

    const observed: Observed = {
      live: undefined,
      questions: [],
      record: undefined,
      names: { skills: [], agents: [] },
    };

    let current: SessionState | null = null;
    let isScheduled = false;
    let isAttached = false;

    const stopRun = Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;

      yield* Effect.promise(() =>
        harness.commit(async (tx) => {
          if (observed.record != null) {
            (await tx.doc(RecordDoc, sessionId, observed.record)).lastStopped = now;
          }
        }, BACKGROUND_CONTEXT),
      );
      yield* browser.close();
    });

    const report = Effect.gen(function* () {
      const next = deriveState(observed);

      if (
        !isAttached ||
        next == null ||
        (current != null && changeKey(current) === changeKey(next))
      ) {
        return;
      }

      const isPreviouslyActive = current != null && isActive(current);

      current = next;

      if (isPreviouslyActive && !isActive(next)) {
        yield* stopRun;
      }

      yield* registry.setStatus(sessionId, statusOf(next)).pipe(Effect.orDie);

      if (isPreviouslyActive && SessionState.guards.idle(next)) {
        const entry = yield* lastEntry(harness);

        yield* channel.send(entry == null ? next : { ...next, lastEntry: entry });
      } else {
        yield* channel.send(next);
      }

      yield* Deferred.succeed(reported, undefined);
    }).pipe(reporting.withPermits(1));

    // A commit advances each observer it touches synchronously, one after the
    // other; deriving once they all ran sees the commit whole.
    const changed = () => {
      if (isScheduled) {
        return;
      }

      isScheduled = true;
      queueMicrotask(() => {
        isScheduled = false;
        Effect.runForkWith(services)(report);
      });
    };

    const attachOne = <T>(
      attach: (target: Observer<T>) => Promise<Observation<T> | undefined>,
      apply: (value: T) => void,
    ) =>
      Effect.acquireRelease(
        Effect.promise(() =>
          attach({
            advance: (call) => {
              if (call.kind === "value") {
                apply(call.value);
                changed();
              }
            },
            end: () => {},
          }),
        ),
        (observation) => Effect.sync(() => observation?.detach()),
      ).pipe(
        Effect.tap((observation) =>
          Effect.sync(() => {
            if (observation != null) {
              apply(observation.value);
            }
          }),
        ),
        Scope.provide(scope),
      );

    return {
      /** RegistryStore.add, with no status until the first report. */
      register: (name: string, parent: Parent, details: SessionDetails) =>
        registry.add(sessionId, name, parent, details).pipe(Effect.orDie),

      /**
       * Start observing a session whose record exists. What it shows now is the
       * baseline, never reported; every later change is.
       */
      attach: Effect.gen(function* () {
        // The documents never change after create, so one read serves every state.
        const readNames = Effect.promise(async (): Promise<Observed["names"]> => {
          const [skills, agents] = await Promise.all([
            harness.snapshot(SkillsDoc, BACKGROUND_CONTEXT),
            harness.snapshot(AgentsDoc, BACKGROUND_CONTEXT),
          ]);

          return {
            skills: (skills?.skills ?? []).map((skill) => skill.name),
            agents: (agents?.agents ?? []).map((agent) => agent.name),
          };
        });

        const attachObservers = Effect.gen(function* () {
          yield* attachOne<Readonly<LiveState>>(
            (target) =>
              harness.observeDoc(LiveDoc, ROOT_CONVERSATION_ID, target, BACKGROUND_CONTEXT),
            (value) => {
              observed.live = value;
            },
          );
          yield* attachOne<Readonly<{ questions: StoredQuestion[] }>>(
            (target) => harness.observeDoc(QuestionsDoc, target, BACKGROUND_CONTEXT),
            (value) => {
              observed.questions = value.questions;
            },
          );
          yield* attachOne<Readonly<SessionRecord>>(
            (target) => harness.observeDoc(RecordDoc, sessionId, target, BACKGROUND_CONTEXT),
            (value) => {
              observed.record = value;
            },
          );
        });

        const [, names] = yield* Effect.all([attachObservers, readNames], {
          concurrency: "unbounded",
        });

        observed.names = names;
        current = deriveState(observed);
        isAttached = true;
      }),

      /** Resolves once a status was reported since attach. */
      reported: Deferred.await(reported),

      /**
       * Whether a question's tool call is still in pi.live, answered or not, as
       * last observed. Synchronous, for pi-durable's settings.
       */
      questionCallLive: () => liveQuestions(observed).length > 0,

      /** The state as the documents show it now, without a run's last entry. */
      current: readObserved(harness, sessionId).pipe(
        Effect.map((read) => deriveState({ ...read, names: observed.names })),
      ),

      /** The state as `current` gives it, with the record it was derived from, both from one read. */
      currentWithRecord: readObserved(harness, sessionId).pipe(
        Effect.map((read) => ({
          state: deriveState({ ...read, names: observed.names }),
          record: read.record,
        })),
      ),
    };
  });
