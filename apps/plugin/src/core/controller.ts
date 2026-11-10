import type { TentaclesError } from "@tentacles/worker-api/errors";
import { ParentSessionId, SessionId } from "@tentacles/worker-api/ids";
import type { Harness, Parent } from "@tentacles/worker-api/parent";
import {
  SessionRef,
  SessionStatuses,
  type SessionState,
  type SessionStatus,
  statusOf,
} from "@tentacles/worker-api/session-state";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";

import type { Glue, ToolOutcome, ToolRun, WatchProcess } from "./glue.ts";
import {
  CommandResultJson,
  HelperError,
  Success,
  WatchLineJson,
  type CommandResult,
  type WatchLine,
} from "./helper-output.ts";
import { LocalState } from "./local-state.ts";
import { createLineSplitter, isOpen, renderStatusLine } from "./status-line.ts";
import { ToolEntry, ToolNames, toolsFor, type EndpointToolEntry } from "./tool-table.ts";
import { failureWake, finishWake, questionWake } from "./wake-texts.ts";

export interface StartOptions {
  readonly parentSessionId: string;
  /** A headless parent (`claude -p`, pi's print mode) gets no watch and no wake. */
  readonly isInteractive: boolean;
}

export interface Controller {
  readonly start: (options: StartOptions) => Promise<void>;
  readonly stop: () => void;
}

const SessionArguments = Schema.Struct({ sessionId: SessionId });

const SpawnResult = Schema.Struct({ sessionId: SessionId });

const NamedArguments = Schema.Struct({ name: Schema.String });

const SessionRefs = Schema.Array(SessionRef);

const decodeCommandResult = Schema.decodeUnknownOption(CommandResultJson);

const decodeWatchLine = Schema.decodeUnknownOption(WatchLineJson);

const failureText = Match.type<TentaclesError>().pipe(
  Match.tagsExhaustive({
    SessionNotFound: (error) => `SessionNotFound: session ${error.sessionId} does not exist.`,
    QuestionNotWaiting: (error) =>
      `QuestionNotWaiting: question ${error.questionId} is no longer waiting.`,
    Unauthorized: () => "Unauthorized: the Worker refused the API key in TENTACLES_API_KEY.",
  }),
);

// What the parent was last woken with per session: a watch restart reconnects
// every socket and each sends its current state, which must not wake again.
const wakeKeyOf = (state: SessionState) =>
  Match.value(state).pipe(
    Match.tag(
      SessionStatuses.waiting,
      (waiting) => `${SessionStatuses.waiting}:${waiting.question.id}`,
    ),
    Match.orElse(statusOf),
  );

/** Holds the local-state transitions, which states wake the parent and when the watch restarts; both glues run it. */
export const createController = (glue: Glue, harness: Harness): Controller => {
  let parent: Parent | undefined;
  let isInteractive = false;
  let sessions: ReadonlyArray<SessionRef> = [];
  let watchProcess: WatchProcess | undefined;
  let waiters: Array<(text: string) => void> = [];

  const wakeKeys = new Map<SessionId, string>();

  // Wakes that went out as a message while no wait was registered: pi holds such a message until
  // its turn ends, so a wait called in that turn returns the wake instead of waiting for the next.
  const unwaited = new Map<SessionId, string>();

  const save = (next: ReadonlyArray<SessionRef>) => {
    sessions = next;
    glue.status(renderStatusLine(sessions));
    void glue.writeState(LocalState.make({ sessions })).catch(() => undefined);
  };

  const setStatus = (sessionId: SessionId, status: SessionStatus) => {
    const isUnchanged = sessions.some(
      (session) => session.sessionId === sessionId && session.status === status,
    );

    if (isUnchanged) {
      return;
    }

    save(
      sessions.map((session) =>
        session.sessionId === sessionId ? { ...session, status } : session,
      ),
    );
  };

  const drop = (sessionId: SessionId) => {
    wakeKeys.delete(sessionId);
    unwaited.delete(sessionId);
    save(sessions.filter((session) => session.sessionId !== sessionId));
  };

  const deliver = (sessionId: SessionId, text: string) => {
    if (waiters.length === 0) {
      unwaited.delete(sessionId);
      unwaited.set(sessionId, text);
      glue.wake(text);

      return;
    }

    const woken = waiters;

    waiters = [];
    woken.forEach((resolve) => resolve(text));
  };

  const onStateLine = (sessionId: SessionId, state: SessionState) => {
    const session = sessions.find((candidate) => candidate.sessionId === sessionId);

    if (session == null) {
      return;
    }

    setStatus(sessionId, statusOf(state));

    const key = wakeKeyOf(state);

    if (wakeKeys.get(sessionId) === key) {
      return;
    }

    wakeKeys.set(sessionId, key);

    const text = Match.value(state).pipe(
      Match.tag(SessionStatuses.waiting, (waiting) => questionWake(session, waiting.question)),
      Match.tag(SessionStatuses.idle, (idle) => finishWake(session, idle.lastEntry)),
      Match.tag(SessionStatuses.failed, (failed) => failureWake(session, failed.failure)),
      Match.orElse(() => undefined),
    );

    if (text == null) {
      unwaited.delete(sessionId);

      return;
    }

    deliver(sessionId, text);
  };

  const onWatchLine = (line: WatchLine) => {
    if ("error" in line) {
      drop(line.sessionId);

      return;
    }

    onStateLine(line.sessionId, line.state);
  };

  const restartWatch = () => {
    watchProcess?.stop();
    watchProcess = undefined;

    const open = sessions.filter(isOpen);

    if (!isInteractive || open.length === 0) {
      return;
    }

    const onOutput = createLineSplitter((raw) => {
      Option.map(decodeWatchLine(raw), onWatchLine);
    });

    watchProcess = glue.watch(
      open.map((session) => session.sessionId),
      onOutput,
    );
  };

  const runCommand = async (name: string, args: Schema.JsonObject): Promise<CommandResult> => {
    const printed = await glue.runHelper([name, JSON.stringify(args)]).catch(String);
    const lastLine = printed.trim().split("\n").at(-1) ?? "";

    return Option.getOrElse(decodeCommandResult(lastLine), () =>
      HelperError.make({ message: `The helper printed no result: ${printed.trim() || "nothing"}` }),
    );
  };

  const afterSuccess = (
    tool: EndpointToolEntry,
    args: Schema.JsonObject,
    success: typeof Success.Type,
  ) => {
    const target = Option.map(
      Schema.decodeUnknownOption(SessionArguments)(args),
      (decoded) => decoded.sessionId,
    );

    Match.value(tool.name).pipe(
      Match.when(ToolNames.spawn, () => {
        const created = Schema.decodeUnknownSync(SpawnResult)(success.result);
        const { name } = Schema.decodeUnknownSync(NamedArguments)(args);

        wakeKeys.set(created.sessionId, SessionStatuses.running);
        save([
          ...sessions,
          SessionRef.make({ sessionId: created.sessionId, name, status: SessionStatuses.running }),
        ]);
        restartWatch();
      }),
      Match.when(ToolNames.close, () => {
        Option.map(target, (sessionId) => {
          unwaited.delete(sessionId);
          setStatus(sessionId, SessionStatuses.closed);
          restartWatch();
        });
      }),
      Match.when(ToolNames.prompt, () => {
        const reopened = Option.filter(target, (sessionId) =>
          sessions.some(
            (session) =>
              session.sessionId === sessionId && session.status === SessionStatuses.closed,
          ),
        );

        Option.map(reopened, (sessionId) => {
          wakeKeys.set(sessionId, SessionStatuses.running);
          setStatus(sessionId, SessionStatuses.running);
          restartWatch();
        });
      }),
      Match.orElse(() => undefined),
    );
  };

  const runEndpoint = async (
    tool: EndpointToolEntry,
    args: Schema.JsonObject,
  ): Promise<ToolOutcome> => {
    const current = parent;

    if (current == null) {
      return { isError: true, text: "The tentacles plugin has not started for this session yet." };
    }

    const request = Match.value(tool.name).pipe(
      Match.when(ToolNames.spawn, () => Object.assign({}, args, { parent: current })),
      Match.when(ToolNames.list, () => ({ parent: current })),
      Match.orElse(() => args),
    );

    const result = await runCommand(tool.name, request);

    return Match.value(result).pipe(
      Match.tagsExhaustive({
        Success: (success) => {
          afterSuccess(tool, args, success);

          return { isError: false, text: JSON.stringify(success.result ?? "Done.") };
        },
        Failure: (failure) => {
          if (Predicate.isTagged(failure.error, "SessionNotFound")) {
            drop(failure.error.sessionId);
            restartWatch();
          }

          return { isError: true, text: failureText(failure.error) };
        },
        HelperError: (error) => ({ isError: true, text: error.message }),
      }),
    );
  };

  const runWait: ToolRun = (_args, signal) => {
    const isAnyOpen = sessions.some(isOpen);

    if (!isAnyOpen || !isInteractive) {
      return Promise.resolve({
        isError: false,
        text: "No remote agent is open, so there is nothing to wait for.",
      });
    }

    const [pending] = unwaited;

    if (pending != null) {
      const [sessionId, text] = pending;

      unwaited.delete(sessionId);

      return Promise.resolve({ isError: false, text });
    }

    return new Promise((resolve) => {
      const waiter = (text: string) => resolve({ isError: false, text });

      waiters.push(waiter);
      signal?.addEventListener("abort", () => {
        waiters = waiters.filter((candidate) => candidate !== waiter);
        resolve({ isError: true, text: "The wait was cancelled." });
      });
    });
  };

  for (const tool of toolsFor(harness)) {
    glue.registerTool(
      tool,
      ToolEntry.$match(tool, {
        Endpoint:
          (endpoint): ToolRun =>
          (args) =>
            runEndpoint(endpoint, args),
        WatchOnly: () => runWait,
      }),
    );
  }

  return {
    start: async (options) => {
      parent = { harness, sessionId: ParentSessionId.make(options.parentSessionId) };
      waiters = [];
      wakeKeys.clear();
      unwaited.clear();
      isInteractive = options.isInteractive;

      const local = await glue.readState();

      sessions = local.sessions;

      // Keyed by what the parent last saw, so a change it missed while away still wakes it once
      // the watch connects.
      sessions.forEach((session) => wakeKeys.set(session.sessionId, session.status));

      if (sessions.length > 0) {
        const listed = await runCommand(ToolNames.list, { parent });

        if (Predicate.isTagged(listed, "Success")) {
          sessions = Schema.decodeUnknownSync(SessionRefs)(listed.result);
        }

        save(sessions);
      }

      glue.status(renderStatusLine(sessions));
      restartWatch();
    },
    stop: () => {
      watchProcess?.stop();
      watchProcess = undefined;
      glue.status(undefined);
    },
  };
};
