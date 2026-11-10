import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BACKGROUND_CONTEXT, type Context as ChordContext } from "@earendil-works/chord/context";
import { CodemodeSandbox } from "@earendil-works/pi-codemode";
import { createModels } from "@earendil-works/pi-ai/models";
import { type FauxProviderHandle, fauxProvider } from "@earendil-works/pi-ai/providers/faux";
import {
  type ConversationId,
  type EntryId,
  type Id,
  MemoryStorage,
  type Storage,
} from "@earendil-works/pi-durable";
import { Browser } from "@tentacles/contracts/browser";
import { CodeSandbox } from "@tentacles/contracts/code-sandbox";
import { ModelProviders } from "@tentacles/contracts/model-providers";
import { ParentChannel } from "@tentacles/contracts/parent-channel";
import { PreviewRouter } from "@tentacles/contracts/preview-router";
import { RegistryStore } from "@tentacles/contracts/registry-store";
import { SessionHost } from "@tentacles/contracts/session-host";
import { SessionStorage } from "@tentacles/contracts/session-storage";
import { WakeTimer } from "@tentacles/contracts/wake-timer";
import { Workspace } from "@tentacles/contracts/workspace";
import { SessionId } from "@tentacles/worker-api/ids";
import type { SessionState } from "@tentacles/worker-api/session-state";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";

import { Session, type SessionHandle } from "../../src/index.ts";
import { eventually } from "./eventually.ts";
import { testRegistry } from "./registry.ts";
import { testWorkspace, type WorkspaceRecord } from "./workspace.ts";

/** A WakeTimer call: the time it was set to, or null for a clear. */
export type WakeCall = number | null;

export type BrowserCall = "open" | "close";

/** Everything a session did through its own contracts, in order. */
export interface SessionRecords {
  readonly states: SessionState[];
  readonly wakes: WakeCall[];
  readonly browser: BrowserCall[];
  readonly workspace: WorkspaceRecord;
}

/** Contract calls a test makes fail, each a defect as an implementation's crash would be. */
export interface Failures {
  browserOpen: boolean;
  openPreview: boolean;
  stoppedBefore: boolean;
  /** Session ids whose next delete fails. */
  readonly deleteOnce: Set<SessionId>;
}

// pi-durable closes its storage when a harness closes; an eviction reopens the
// same memory, so closing it is left to nobody.
class ReopenableStorage extends MemoryStorage {
  override async close() {}
}

const never = <T>() => new Promise<T>(() => {});

/**
 * One instance's view of the session's storage. Once killed, no call of it
 * settles, as for a process that died: the instance never writes again.
 */
class ProcessStorage implements Storage {
  readonly #storage: ReopenableStorage;
  #isDead = false;

  constructor(storage: ReopenableStorage) {
    this.#storage = storage;
  }

  kill() {
    this.#isDead = true;
  }

  #answer<T>(call: () => Promise<T>) {
    return this.#isDead ? never<T>() : call();
  }

  commit(...args: Parameters<Storage["commit"]>) {
    return this.#answer(() => this.#storage.commit(...args));
  }

  mintId<I extends Id<string>>() {
    return this.#answer(() => this.#storage.mintId<I>());
  }

  conversation(...args: Parameters<Storage["conversation"]>) {
    return this.#answer(() => this.#storage.conversation(...args));
  }

  scanConversations(...args: Parameters<Storage["scanConversations"]>) {
    return this.#answer(() => this.#storage.scanConversations(...args));
  }

  entry(id: EntryId, context: ChordContext): ReturnType<Storage["entry"]>;
  entry(
    conversationId: ConversationId,
    id: EntryId,
    context: ChordContext,
  ): ReturnType<Storage["entry"]>;
  entry(...args: [EntryId, ChordContext] | [ConversationId, EntryId, ChordContext]) {
    return this.#answer(() =>
      args.length === 2
        ? this.#storage.entry(args[0], args[1])
        : this.#storage.entry(args[0], args[1], args[2]),
    );
  }

  findLatestHeadMarker(...args: Parameters<Storage["findLatestHeadMarker"]>) {
    return this.#answer(() => this.#storage.findLatestHeadMarker(...args));
  }

  scanEntries(...args: Parameters<Storage["scanEntries"]>) {
    return this.#answer(() => this.#storage.scanEntries(...args));
  }

  task(...args: Parameters<Storage["task"]>) {
    return this.#answer(() => this.#storage.task(...args));
  }

  scanTasks(...args: Parameters<Storage["scanTasks"]>) {
    return this.#answer(() => this.#storage.scanTasks(...args));
  }

  submission(...args: Parameters<Storage["submission"]>) {
    return this.#answer(() => this.#storage.submission(...args));
  }

  scanSubmissions(...args: Parameters<Storage["scanSubmissions"]>) {
    return this.#answer(() => this.#storage.scanSubmissions(...args));
  }

  submissionByRequest(...args: Parameters<Storage["submissionByRequest"]>) {
    return this.#answer(() => this.#storage.submissionByRequest(...args));
  }

  findDocument(...args: Parameters<Storage["findDocument"]>) {
    return this.#answer(() => this.#storage.findDocument(...args));
  }

  document(...args: Parameters<Storage["document"]>) {
    return this.#answer(() => this.#storage.document(...args));
  }

  scanDocuments(...args: Parameters<Storage["scanDocuments"]>) {
    return this.#answer(() => this.#storage.scanDocuments(...args));
  }

  close() {
    return this.#answer(() => this.#storage.close());
  }
}

/** The world a core test runs in, and the session host it reaches sessions through. */
export class TestWorld extends Context.Service<
  TestWorld,
  {
    /** pi-ai's faux provider: every session's model. */
    readonly faux: FauxProviderHandle;
    /** A directory the sandboxed workspaces also see, for bare remotes. */
    readonly shared: string;
    readonly failures: Failures;
    /** RegistryStore's add and setStatus calls, as "add <id>" and "<status> <id>". */
    readonly registryCalls: string[];
    readonly records: (sessionId: SessionId) => SessionRecords;
    /** The running instance's handle, made on first use as a host makes one on a request. */
    readonly handle: (sessionId: SessionId) => Effect.Effect<SessionHandle>;
    /** Drops the instance, its harness closed mid-work, and keeps its storage. */
    readonly evict: (sessionId: SessionId) => Effect.Effect<void>;
    /**
     * Drops the instance as a process that dies does: its harness never closes
     * and its storage stops answering it. The next instance counts the
     * restarts of the work it cut off.
     */
    readonly crash: (sessionId: SessionId) => Effect.Effect<void>;
    /** Resolves once the running instance took up every task left pending. */
    readonly pickedUp: (sessionId: SessionId) => Effect.Effect<void>;
  }
>()("test/TestWorld") {}

const crash = (what: string) => Effect.die(new Error(`${what} failed`));

const makeWorld = Effect.gen(function* () {
  const root = yield* Effect.acquireRelease(
    Effect.sync(() => mkdtempSync(join(tmpdir(), "tentacles-core-"))),
    (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true })),
  );

  const shared = join(root, "shared");

  mkdirSync(shared);

  const faux = fauxProvider();
  const models = createModels();

  models.setProvider(faux.provider);

  const failures: Failures = {
    browserOpen: false,
    openPreview: false,
    stoppedBefore: false,
    deleteOnce: new Set(),
  };

  const registry = yield* RegistryStore;
  const registryCalls: string[] = [];

  const failing = RegistryStore.of({
    ...registry,
    add: (sessionId, name, parent) =>
      Effect.sync(() => void registryCalls.push(`add ${sessionId}`)).pipe(
        Effect.andThen(registry.add(sessionId, name, parent)),
      ),
    setStatus: (sessionId, status) =>
      Effect.sync(() => void registryCalls.push(`${status} ${sessionId}`)).pipe(
        Effect.andThen(registry.setStatus(sessionId, status)),
      ),
    openPreview: (sessionId, port) =>
      failures.openPreview ? crash("openPreview") : registry.openPreview(sessionId, port),
    stoppedBefore: (before) =>
      failures.stoppedBefore ? crash("stoppedBefore") : registry.stoppedBefore(before),
  });

  const shareds = Context.make(RegistryStore, failing).pipe(
    Context.add(ModelProviders, ModelProviders.of({ models: () => Effect.succeed(models) })),
    Context.add(
      PreviewRouter,
      PreviewRouter.of({ url: (token) => Effect.succeed(`https://${token}.preview.test/`) }),
    ),
    Context.add(
      CodeSandbox,
      CodeSandbox.of({ sandbox: () => Effect.succeed(new CodemodeSandbox()) }),
    ),
  );

  const records = new Map<SessionId, SessionRecords>();
  const storages = new Map<SessionId, ReopenableStorage>();

  const instances = new Map<
    SessionId,
    { handle: SessionHandle; scope: Scope.Closeable; storage: ProcessStorage }
  >();

  const making = yield* Semaphore.make(1);
  const worldScope = yield* Scope.Scope;

  const workspaces = new Map<SessionId, Workspace["Service"]>();

  const recordsOf = (sessionId: SessionId) =>
    Effect.gen(function* () {
      const found = records.get(sessionId);

      if (found != null) {
        return found;
      }

      const created = yield* testWorkspace(join(root, sessionId), shared).pipe(
        Scope.provide(worldScope),
      );

      const record: SessionRecords = {
        states: [],
        wakes: [],
        browser: [],
        workspace: created.record,
      };

      records.set(sessionId, record);
      workspaces.set(sessionId, created.workspace);

      return record;
    });

  const workspaceOf = (sessionId: SessionId) => {
    const found = workspaces.get(sessionId);

    if (found == null) {
      throw new Error(`No workspace was created for session ${sessionId}`);
    }

    return found;
  };

  const storageOf = (sessionId: SessionId) => {
    const found = storages.get(sessionId);

    if (found != null) {
      return found;
    }

    const created = new ReopenableStorage();

    storages.set(sessionId, created);

    return created;
  };

  const sessionContext = (sessionId: SessionId, record: SessionRecords, opened: Storage) =>
    Context.make(SessionStorage, SessionStorage.of({ storage: () => Effect.succeed(opened) })).pipe(
      Context.add(
        WakeTimer,
        WakeTimer.of({
          set: (at) => Effect.sync(() => void record.wakes.push(at)),
          clear: () => Effect.sync(() => void record.wakes.push(null)),
        }),
      ),
      Context.add(
        ParentChannel,
        ParentChannel.of({ send: (state) => Effect.sync(() => void record.states.push(state)) }),
      ),
      Context.add(
        Browser,
        Browser.of({
          open: () =>
            Effect.gen(function* () {
              record.browser.push("open");

              if (failures.browserOpen) {
                return yield* crash("Browser.open");
              }

              return { cdpUrl: `wss://browser.test/${record.browser.length}` };
            }),
          close: () => Effect.sync(() => void record.browser.push("close")),
        }),
      ),
      Context.add(Workspace, workspaceOf(sessionId)),
      Context.merge(shareds),
    );

  const handle = (sessionId: SessionId) =>
    Effect.gen(function* () {
      const running = instances.get(sessionId);

      if (running != null) {
        return running.handle;
      }

      const record = yield* recordsOf(sessionId);
      const scope = yield* Scope.make();
      const storage = new ProcessStorage(storageOf(sessionId));

      const made = yield* Session.make(sessionId).pipe(
        Effect.provideContext(sessionContext(sessionId, record, storage)),
        Scope.provide(scope),
      );

      instances.set(sessionId, { handle: made, scope, storage });

      return made;
    }).pipe(making.withPermits(1));

  const drop = (sessionId: SessionId) =>
    Effect.gen(function* () {
      const running = instances.get(sessionId);

      instances.delete(sessionId);

      if (running != null) {
        yield* Scope.close(running.scope, Exit.void);
      }
    });

  const crashOne = (sessionId: SessionId) =>
    Effect.sync(() => {
      instances.get(sessionId)?.storage.kill();
      instances.delete(sessionId);
    });

  const pickedUp = (sessionId: SessionId) =>
    eventually(
      Effect.promise(() =>
        storageOf(sessionId).scanTasks({ status: "pending" }, 1, undefined, BACKGROUND_CONTEXT),
      ).pipe(
        Effect.flatMap((page) =>
          page.items.length === 0 ? Effect.void : Effect.die(new Error("tasks still pending")),
        ),
      ),
    );

  yield* Effect.addFinalizer(() => Effect.forEach([...instances.keys()], drop, { discard: true }));

  const notFoundGuard = <A, E>(
    sessionId: SessionId,
    use: (made: SessionHandle) => Effect.Effect<A, E>,
  ) => Effect.flatMap(handle(sessionId), use);

  const host = SessionHost.of({
    create: (sessionId, request) => notFoundGuard(sessionId, (made) => made.create(request)),
    prompt: (sessionId, request) => notFoundGuard(sessionId, (made) => made.prompt(request)),
    answer: (sessionId, request) => notFoundGuard(sessionId, (made) => made.answer(request)),
    close: (sessionId) => notFoundGuard(sessionId, (made) => made.close()),
    messages: (sessionId, count) => notFoundGuard(sessionId, (made) => made.messages(count)),
    status: (sessionId) => notFoundGuard(sessionId, (made) => made.status()),
    // Node cannot build a 101 response, so the socket stands in as one whose
    // body is the first message: the state sent on connect.
    connect: (sessionId) =>
      notFoundGuard(sessionId, (made) =>
        made.status().pipe(Effect.map((state) => socketUpgrade(JSON.stringify(state)))),
      ),
    preview: (sessionId, port, request) =>
      notFoundGuard(sessionId, (made) => made.preview(port, request)),
    delete: (sessionId) =>
      failures.deleteOnce.delete(sessionId)
        ? crash("SessionHost.delete")
        : Effect.gen(function* () {
            yield* notFoundGuard(sessionId, (made) => made.delete());
            yield* drop(sessionId);
            storages.delete(sessionId);
          }),
  });

  const world = TestWorld.of({
    faux,
    shared,
    failures,
    registryCalls,
    records: (sessionId) => {
      const found = records.get(sessionId);

      if (found == null) {
        throw new Error(`no records for ${sessionId}`);
      }

      return found;
    },
    handle,
    evict: drop,
    crash: crashOne,
    pickedUp,
  });

  return { world, host, failing };
});

/**
 * A socket upgrade as a test's host answers it. Node refuses to construct a
 * 101, so the status is set on a built response.
 */
const socketUpgrade = (firstMessage: string) =>
  Object.defineProperty(new Response(firstMessage), "status", { value: 101 });

/** TestWorld, SessionHost and RegistryStore for a core test, over fresh storage. */
export const testWorld = Layer.effectContext(
  makeWorld.pipe(
    Effect.map(({ world, host, failing }) =>
      Context.make(TestWorld, world).pipe(
        Context.add(SessionHost, host),
        Context.add(RegistryStore, failing),
      ),
    ),
  ),
).pipe(Layer.provide(testRegistry));

/** A new random session id. */
export const newSessionId = () => Schema.decodeSync(SessionId)(crypto.randomUUID());
