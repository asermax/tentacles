import type { Workspace } from "@cloudflare/computer";
import type { WorkspaceInit } from "@tentacles/contracts/workspace";
import type { Parent } from "@tentacles/worker-api/parent";
import type { FakeContainerSetup, FakeContainerSnapshot } from "./fake-container";
import type { CreateSession } from "@tentacles/worker-api/sessions";
import type {
  SessionDetails,
  SessionListing,
  SessionStatus,
} from "@tentacles/worker-api/session-state";

// The session object's RPC as a test calls it, the way the Worker's SessionHost does.
interface SessionRpc extends Rpc.DurableObjectBranded {
  create(request: CreateSession): void;
  delete(): void;
  restart(): void;
  storedTables(): ReadonlyArray<string>;
}

// A workspace object as a test calls it: the deployed object's setUpWorkspace and destroy, and the files the
// test entry's subclass reads back.
interface WorkspaceRpc extends Rpc.DurableObjectBranded {
  setUpWorkspace(init: WorkspaceInit): void;
  destroy(): void;
  failNextDestroy(): void;
  requestedInstances(): Promise<ReadonlyArray<string | undefined>>;
  containerExecEnvironment(
    callerEnvironment: Record<string, string>,
  ): Promise<Record<string, string>>;
  __getWorkspaceStub(): Promise<ReturnType<Workspace["stub"]>>;
  files(): ReadonlyArray<{ path: string; mode: number; size: number; text: string }>;
  directoriesAmong(paths: ReadonlyArray<string>): ReadonlyArray<string>;
}

// The Claude object's test entry: its container is a fake, and these read and drive it and the
// object's storage.
interface ClaudeRpc extends Rpc.DurableObjectBranded {
  restart(): void;
  reset(setup: FakeContainerSetup): Promise<void>;
  containerState(): FakeContainerSnapshot;
  stopContainer(): void;
  storedCalls(): {
    callIds: ReadonlyArray<string>;
    isStopping: boolean;
    lastActivity: number | null;
  };
  storeCall(callId: string): void;
  storeStopping(): void;
  storeLastActivity(agoMs: number): void;
  alarmAt(): number | null;
  runAlarm(): Promise<void>;
}

// The registry object's RPC as a test calls it from outside the Worker: each member of
// RegistryStore, answered by the Alchemy bridge with its plain result.
interface RegistryRpc extends Rpc.DurableObjectBranded {
  add(sessionId: string, name: string, parent: Parent, details: SessionDetails): void;
  setStatus(sessionId: string, status: SessionStatus): void;
  list(parent: Parent): ReadonlyArray<SessionListing>;
  openPreview(sessionId: string, port: number): { token: string };
}

// GATEWAY is the Workspace Worker's default entrypoint with a workspace's gateway props, as the
// container's outbound requests reach it. BROWSER_STUB is the Workspace Worker's Browser binding
// stub, which records the sessions it is asked for.
declare global {
  namespace Cloudflare {
    interface Env {
      // The Worker's own handlers, reached through a service binding; the binding's type in
      // workers-types leaves out the scheduled handler that service_binding_extra_handlers adds.
      readonly TENTACLES: Fetcher & {
        scheduled(options: { cron: string; scheduledTime: Date }): Promise<{ outcome: string }>;
      };
      readonly GATEWAY: Fetcher;
      readonly BROWSER_STUB: Fetcher & { connectedSessions(): Promise<ReadonlyArray<string>> };
      readonly SessionObject: DurableObjectNamespace<SessionRpc>;
      readonly ClaudeObject: DurableObjectNamespace<ClaudeRpc>;
      readonly RegistryObject: DurableObjectNamespace<RegistryRpc>;
      readonly WorkspaceObject: DurableObjectNamespace<WorkspaceRpc>;
    }
  }
}
