import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import {
  createRegistry,
  type Cursor,
  DEFAULT_RESTART_LIMIT,
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
import { SkillsArchive } from "@tentacles/contracts/skills-archive";
import { WakeTimer } from "@tentacles/contracts/wake-timer";
import { Workspace, workspaceDirectory } from "@tentacles/contracts/workspace";
import { readAgentsArchive, readSkillsArchive } from "@tentacles/worker-api/archives";
import type { Entry } from "@tentacles/worker-api/entries";
import { QuestionNotWaiting, SessionNotFound } from "@tentacles/worker-api/errors";
import type { SessionId } from "@tentacles/worker-api/ids";
import { isActive, SessionState } from "@tentacles/worker-api/session-state";
import { PromptModes } from "@tentacles/worker-api/sessions";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

import { AgentsDoc } from "../tools/agents-doc.ts";
import { remoteAgentExtensions } from "../tools/extension.ts";
import { expandSkills, SkillsDoc, toSkillEntry } from "../tools/skills.ts";
import { toEntries } from "./entries.ts";
import { QuestionsDoc } from "./questions.ts";
import { RecordDoc, type SessionRecord } from "./record.ts";
import { trackStatus } from "./state.ts";
import { workspaceEnv } from "./workspace-env.ts";
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
  readonly workspaceNeeded: (isWorkPending: boolean) => Effect.Effect<boolean>;
};

const make = (sessionId: SessionId) =>
  Effect.gen(function* () {
    const services = yield* Effect.context<
      Browser | CodeSandbox | ParentChannel | PreviewRouter | RegistryStore | Workspace
    >();

    const skillsArchive = yield* SkillsArchive;

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

    // Set once the status tracker exists, which needs the open harness; the
    // harness reads the restart limit only once it resumes, after that.
    let status: Effect.Success<ReturnType<typeof trackStatus>> | null = null;

    const registry = createRegistry();
    const envId = `pi-env:${sessionId}`;

    for (const extension of yield* remoteAgentExtensions(sessionId)) {
      registry.install(extension);
    }

    const harness = yield* Effect.acquireRelease(
      Effect.promise(() =>
        Harness.open(
          storage,
          {
            models,
            registry,
            settings: {
              // A question waits for its answer however long that takes, and
              // every eviction cuts its tool call off. pi-durable counts each
              // cut-off toward the restart limit and has no durable wait for a
              // tool, so the limit is lifted while a question's call is live.
              get restartLimit() {
                return status != null && status.questionCallLive()
                  ? Infinity
                  : DEFAULT_RESTART_LIMIT;
              },
            },
            onWake: (wake) => {
              fork(arm(wake));
            },
            // pi-durable calls this before every tool use and for section
            // renders; the workspace opens on the env's first operation, and a
            // failure there becomes that call's error result.
            env: (target) =>
              workspaceEnv(envId, workspaceDirectory, async () => {
                const record = await target.read.snapshot(RecordDoc, sessionId, BACKGROUND_CONTEXT);

                if (record == null) {
                  throw new Error("The session has no record to start its workspace from");
                }

                const { repository, image, size, lifetime } = record.settings;

                await run(workspace.ensure({ repository, image, size, lifetime }));

                return new RemoteExecutionEnv({
                  connection: await run(workspace.connection()),
                  id: envId,
                  cwd: workspaceDirectory,
                });
              }),
            onReport: (report) => {
              fork(Effect.logError("pi-durable reported a failure", report.kind, report));
            },
          },
          BACKGROUND_CONTEXT,
        ),
      ),
      (opened) => Effect.promise(() => opened.close(BACKGROUND_CONTEXT)),
    );

    status = yield* trackStatus(harness, sessionId);

    const record = Effect.promise(() => harness.snapshot(RecordDoc, sessionId, BACKGROUND_CONTEXT));

    const existing = record.pipe(
      Effect.filterOrFail(
        (found) => found != null,
        () => new SessionNotFound({ sessionId }),
      ),
    );

    // The record and the state come from one read, so a state is never paired
    // with a record from before the commit that produced it.
    const existingWithState = status.currentWithRecord.pipe(
      Effect.filterOrFail(
        (current): current is { state: SessionState; record: SessionRecord } =>
          current.state != null && current.record != null,
        () => new SessionNotFound({ sessionId }),
      ),
    );

    const root = Effect.promise(() => harness.root(BACKGROUND_CONTEXT));

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
          // Both archives are read before anything is stored, so one that
          // cannot be read leaves no trace.
          const skills = (
            request.skills == null ? [] : yield* readSkillsArchive(request.skills)
          ).map(toSkillEntry);

          const agents = request.agents == null ? [] : yield* readAgentsArchive(request.agents);

          if (request.skills != null) {
            yield* skillsArchive.save(request.skills);
          }

          yield* status.register(request.name, request.parent, {
            settings: request.settings,
            skills: skills.map((skill) => skill.name),
            agents: agents.map((agent) => agent.name),
          });

          const conversation = yield* Effect.promise(() =>
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
                (await tx.doc(SkillsDoc)).skills.push(...skills);
                (await tx.doc(AgentsDoc)).agents.push(...agents);
              },
            }),
          );

          yield* status.attach;
          yield* armActive;
          yield* Effect.promise(() =>
            conversation.submit(
              {
                type: "input",
                content: expandSkills(request.prompt, skills),
                requestId: "create",
              },
              BACKGROUND_CONTEXT,
            ),
          );
          yield* status.reported;
        }),

      prompt: (request) =>
        Effect.gen(function* () {
          const { state, record: found } = yield* existingWithState;
          const conversation = yield* root;

          // While a question waits, a prompt joins its run as a steer, which
          // pi-durable places after the answer's tool round.
          const steers = request.mode === PromptModes.steer || SessionState.guards.waiting(state);

          const skills = yield* Effect.promise(() =>
            harness.snapshot(SkillsDoc, BACKGROUND_CONTEXT),
          );

          const draft: SubmissionDraft = {
            type: "input",
            content: expandSkills(request.text, skills?.skills ?? []),
            whenBusy: steers ? "steer" : "followUp",
          };

          // Only a prompt that starts a run starts the commit prompts over; one
          // sent into a run already going leaves that run's count.
          const startsRun = !isActive(state);

          yield* armActive;

          // One commit admits the prompt, resets the commit prompts and clears
          // the closed mark, so the status never shows the record without the
          // run the prompt starts.
          yield* Effect.promise(() =>
            harness.commit(async (tx) => {
              await conversation.submit(tx, draft);

              const draftRecord = await tx.doc(RecordDoc, sessionId, found);

              draftRecord.closed = false;

              if (startsRun) {
                draftRecord.commitPrompts = 0;
              }
            }, BACKGROUND_CONTEXT),
          );
        }),

      answer: (request) =>
        Effect.gen(function* () {
          yield* existingWithState.pipe(
            Effect.filterOrFail(
              ({ state }) =>
                SessionState.guards.waiting(state) && state.question.id === request.questionId,
              () => new QuestionNotWaiting({ questionId: request.questionId }),
            ),
          );

          yield* Effect.promise(() =>
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

          yield* Effect.promise(() =>
            harness.commit(async (tx) => {
              (await tx.doc(RecordDoc, sessionId, found)).closed = true;
            }, BACKGROUND_CONTEXT),
          );

          const live = yield* Effect.promise(() =>
            harness.snapshot(LiveDoc, ROOT_CONVERSATION_ID, BACKGROUND_CONTEXT),
          );

          if (live?.run != null) {
            const conversation = yield* root;

            yield* armActive;
            yield* Effect.promise(() =>
              conversation.abort(BACKGROUND_CONTEXT, { background: true }),
            );
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
            const page = yield* Effect.promise(() =>
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

      // A session never created has nothing to stop; the provider clears its
      // storage either way.
      delete: () =>
        Effect.gen(function* () {
          if ((yield* record) == null) {
            return;
          }

          const conversation = yield* root;

          yield* Effect.promise(() => conversation.abort(BACKGROUND_CONTEXT, { background: true }));
          yield* wakeTimer.clear();
        }),

      wake: () =>
        Effect.gen(function* () {
          yield* armActive;
          harness.resume();
          yield* arm(harness.wake());
        }),

      workspaceNeeded: (isWorkPending) =>
        Effect.gen(function* () {
          const { state, record: found } = yield* status.currentWithRecord;
          const now = yield* Clock.currentTimeMillis;

          return (
            found != null &&
            state != null &&
            // tentacles manages only the repository its settings name, so
            // pending work elsewhere in /workspace keeps nothing up.
            isWorkspaceNeeded(
              state,
              found.lastStopped,
              isWorkPending && found.settings.repository != null,
              now,
            )
          );
        }),
    };

    return handle;
  });

/** One session's logic around pi-durable, which a provider's session host runs once per instance. */
export const Session = { make } as const;
