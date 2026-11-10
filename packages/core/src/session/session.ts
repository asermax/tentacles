import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import {
  createRegistry,
  type Cursor,
  Harness,
  LiveDoc,
  ROOT_CONVERSATION_ID,
  type SubmissionDraft,
  type Wake,
} from "@earendil-works/pi-durable";
import { RemoteExecutionEnv } from "@earendil-works/pi-env";
import { Browser } from "@tentacles/contracts/browser";
import { CodeSandbox } from "@tentacles/contracts/code-sandbox";
import { ModelProviders } from "@tentacles/contracts/model-providers";
import { ParentChannel } from "@tentacles/contracts/parent-channel";
import { PreviewRouter } from "@tentacles/contracts/preview-router";
import { RegistryStore } from "@tentacles/contracts/registry-store";
import type { SessionHost } from "@tentacles/contracts/session-host";
import { SessionStorage } from "@tentacles/contracts/session-storage";
import { WakeTimer } from "@tentacles/contracts/wake-timer";
import { Workspace } from "@tentacles/contracts/workspace";
import type { Entry } from "@tentacles/worker-api/entries";
import { QuestionNotWaiting, SessionNotFound } from "@tentacles/worker-api/errors";
import type { SessionId } from "@tentacles/worker-api/ids";
import { SessionState } from "@tentacles/worker-api/session-state";
import { PromptModes } from "@tentacles/worker-api/sessions";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

import { remoteAgentExtensions } from "../tools/extension.ts";
import { toEntries } from "./entries.ts";
import { QuestionsDoc } from "./questions.ts";
import { RecordDoc } from "./record.ts";
import { trackStatus } from "./state.ts";
import { workspaceDirectory } from "./workspace-directory.ts";
import { isWorkspaceNeeded } from "./workspace-needed.ts";

// While work runs, the timer also serves as a recovery heartbeat: a process
// that dies mid-run is woken within a minute.
const heartbeatMillis = 60_000;

const ThinkingLevel = Schema.Literals(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);

const decodeThinkingLevel = Schema.decodeUnknownOption(ThinkingLevel);

type HostMembers = SessionHost["Service"];

type WithoutSessionId<Member> = Member extends (
  sessionId: SessionId,
  ...rest: infer Rest
) => infer Result
  ? (...rest: Rest) => Result
  : never;

/** SessionHost's members for one session, minus connect, plus the two calls only a host makes. */
export type SessionHandle = {
  readonly [Key in Exclude<keyof HostMembers, "connect">]: WithoutSessionId<HostMembers[Key]>;
} & {
  /** The host's WakeTimer fired: resume the harness. */
  readonly wake: () => Effect.Effect<void>;
  /** Whether the workspace should stay up; the ping reports whether git shows pending work. */
  readonly workspaceNeeded: (pendingWork: boolean) => Effect.Effect<boolean>;
};

const promise = <A>(evaluate: () => Promise<A>) => Effect.promise(evaluate);

const make = (sessionId: SessionId) =>
  Effect.gen(function* () {
    const services = yield* Effect.context<
      Browser | CodeSandbox | ParentChannel | PreviewRouter | RegistryStore | Workspace
    >();

    const run = Effect.runPromiseWith(services);
    const fork = Effect.runForkWith(services);
    const wakeTimer = yield* WakeTimer;
    const workspace = yield* Workspace;
    const storage = yield* (yield* SessionStorage).storage();
    const models = yield* (yield* ModelProviders).models();
    const arming = yield* Semaphore.make(1);

    const arm = (wake: Wake) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const heartbeat = wake.active ? now + heartbeatMillis : undefined;

        const at =
          heartbeat == null || wake.at == null
            ? (heartbeat ?? wake.at)
            : Math.min(heartbeat, wake.at);

        yield* at == null ? wakeTimer.clear() : wakeTimer.set(at);
      }).pipe(arming.withPermits(1));

    const registry = createRegistry();

    for (const extension of yield* remoteAgentExtensions(sessionId)) {
      registry.install(extension);
    }

    const harness = yield* Effect.acquireRelease(
      promise(() =>
        Harness.open(
          storage,
          {
            models,
            registry,
            onWake: (wake) => {
              fork(arm(wake));
            },
            // pi-durable calls this before every tool use; a failure becomes
            // that call's error result.
            env: async (target, context) => {
              const record = await target.read.snapshot(RecordDoc, sessionId, context);

              await run(workspace.ensure(record?.settings.repository ?? null));

              return new RemoteExecutionEnv({
                connection: await run(workspace.connection()),
                id: `pi-env:${sessionId}`,
                cwd: workspaceDirectory,
              });
            },
          },
          BACKGROUND_CONTEXT,
        ),
      ),
      (opened) => promise(() => opened.close(BACKGROUND_CONTEXT)),
    );

    const status = yield* trackStatus(harness, sessionId);

    const record = promise(() => harness.snapshot(RecordDoc, sessionId, BACKGROUND_CONTEXT));

    const existing = record.pipe(
      Effect.filterOrFail(
        (found) => found != null,
        () => new SessionNotFound({ sessionId }),
      ),
    );

    const root = promise(() => harness.root(BACKGROUND_CONTEXT));

    // Armed before any call that can start work: onWake only follows the
    // commit, and a missing timer strands the work.
    const armActive = Effect.suspend(() => arm({ ...harness.wake(), active: true }));

    if ((yield* record) != null) {
      yield* status.attach;
    }

    yield* arm(harness.wake());
    harness.resume();

    const handle: SessionHandle = {
      create: (request) =>
        Effect.gen(function* () {
          yield* status.register(request.name, request.parent);

          const conversation = yield* promise(() =>
            harness.root(BACKGROUND_CONTEXT, {
              agent: {
                model: { provider: request.settings.provider, modelId: request.settings.model },
                cwd: workspaceDirectory,
                // An effort pi-ai has no thinking level for leaves the model's default.
                thinkingLevel: Option.getOrNull(decodeThinkingLevel(request.settings.effort)),
              },
              init: async (tx) => {
                await tx.doc(RecordDoc, sessionId, {
                  name: request.name,
                  parent: request.parent,
                  settings: request.settings,
                  closed: false,
                  lastStopped: null,
                  commitPrompts: 0,
                });
                await tx.doc(QuestionsDoc);
              },
            }),
          );

          yield* status.attach;
          yield* armActive;
          yield* promise(() =>
            conversation.submit(
              { type: "input", content: request.prompt, requestId: "create" },
              BACKGROUND_CONTEXT,
            ),
          );
          yield* status.reported;
        }),

      prompt: (request) =>
        Effect.gen(function* () {
          const found = yield* existing;
          const conversation = yield* root;

          const draft: SubmissionDraft = {
            type: "input",
            content: request.text,
            whenBusy: request.mode === PromptModes.steer ? "steer" : "followUp",
          };

          yield* armActive;

          // One commit admits the prompt, resets the commit prompts and clears
          // the closed mark, so the status never shows the record without the
          // run the prompt starts.
          yield* promise(() =>
            harness.commit(async (tx) => {
              await conversation.submit(tx, draft);

              const draftRecord = await tx.doc(RecordDoc, sessionId, found);

              draftRecord.closed = false;
              draftRecord.commitPrompts = 0;
            }, BACKGROUND_CONTEXT),
          );
        }),

      answer: (request) =>
        Effect.gen(function* () {
          yield* existing;

          yield* status.current.pipe(
            Effect.filterOrFail(
              (state) =>
                state != null &&
                SessionState.guards.waiting(state) &&
                state.question.id === request.questionId,
              () => new QuestionNotWaiting({ questionId: request.questionId }),
            ),
          );

          yield* promise(() =>
            harness.commit(async (tx) => {
              const questions = await tx.doc(QuestionsDoc);

              for (const question of questions.questions) {
                if (question.id === request.questionId) {
                  question.answer = request.text;
                }
              }
            }, BACKGROUND_CONTEXT),
          );
        }),

      close: () =>
        Effect.gen(function* () {
          const found = yield* existing;

          if (found.closed) {
            return;
          }

          yield* promise(() =>
            harness.commit(async (tx) => {
              (await tx.doc(RecordDoc, sessionId, found)).closed = true;
            }, BACKGROUND_CONTEXT),
          );

          const live = yield* promise(() =>
            harness.snapshot(LiveDoc, ROOT_CONVERSATION_ID, BACKGROUND_CONTEXT),
          );

          if (live?.run != null) {
            const conversation = yield* root;

            yield* armActive;
            yield* promise(() => conversation.abort(BACKGROUND_CONTEXT, { background: true }));
          }
        }),

      messages: (count) =>
        Effect.gen(function* () {
          yield* existing;

          const conversation = yield* root;
          const entries: Entry[] = [];
          let cursor: Cursor | undefined;

          // A pi-durable entry can map to several entries (an answer with text
          // and tool calls), so pages are read until enough are mapped.
          do {
            const page = yield* promise(() =>
              conversation.entries({ order: "descending" }, count, cursor, BACKGROUND_CONTEXT),
            );

            for (const item of page.items) {
              entries.unshift(...toEntries(item));
            }

            cursor = page.next;
          } while (entries.length < count && cursor != null);

          return entries.slice(-count);
        }),

      status: () =>
        status.current.pipe(
          Effect.filterOrFail(
            (state) => state != null,
            () => new SessionNotFound({ sessionId }),
          ),
        ),

      preview: (port, request) => existing.pipe(Effect.andThen(workspace.forward(port, request))),

      delete: () =>
        Effect.gen(function* () {
          const conversation = yield* root;

          yield* promise(() => conversation.abort(BACKGROUND_CONTEXT, { background: true }));
          yield* wakeTimer.clear();
        }),

      wake: () =>
        Effect.gen(function* () {
          yield* armActive;
          harness.resume();
          yield* arm(harness.wake());
        }),

      workspaceNeeded: (pendingWork) =>
        Effect.gen(function* () {
          const found = yield* record;
          const state = yield* status.current;
          const now = yield* Clock.currentTimeMillis;

          return (
            found != null &&
            state != null &&
            isWorkspaceNeeded(state, found.lastStopped, pendingWork, now)
          );
        }),
    };

    return handle;
  });

/** One session's logic around pi-durable, which a provider's session host runs once per instance. */
export const Session = { make } as const;
