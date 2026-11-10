import type { Parent } from "@tentacles/worker-api/parent";
import type { SessionRef, SessionStatus } from "@tentacles/worker-api/session-state";

// The registry object's RPC as a test calls it from outside the Worker: each member of
// RegistryStore, answered by the Alchemy bridge with its plain result.
interface RegistryRpc extends Rpc.DurableObjectBranded {
  add(sessionId: string, name: string, parent: Parent): void;
  setStatus(sessionId: string, status: SessionStatus): void;
  list(parent: Parent): ReadonlyArray<SessionRef>;
}

declare global {
  namespace Cloudflare {
    interface Env {
      readonly TENTACLES: Fetcher;
      readonly RegistryObject: DurableObjectNamespace<RegistryRpc>;
    }
  }
}
