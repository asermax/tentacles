import type { Parent } from "@tentacles/worker-api/parent";
import type { CreateSession } from "@tentacles/worker-api/sessions";
import type {
  SessionDetails,
  SessionListing,
  SessionStatus,
} from "@tentacles/worker-api/session-state";

// The session object's RPC as a test calls it, the way the Worker's SessionHost does.
interface SessionRpc extends Rpc.DurableObjectBranded {
  create(request: CreateSession): void;
  storedSkillsArchive(): Uint8Array | null;
  storedContextArchive(): Uint8Array | null;
}

// The registry object's RPC as a test calls it from outside the Worker: each member of
// RegistryStore, answered by the Alchemy bridge with its plain result.
interface RegistryRpc extends Rpc.DurableObjectBranded {
  add(sessionId: string, name: string, parent: Parent, details: SessionDetails): void;
  setStatus(sessionId: string, status: SessionStatus): void;
  list(parent: Parent): ReadonlyArray<SessionListing>;
}

declare global {
  namespace Cloudflare {
    interface Env {
      // The Worker's own handlers, reached through a service binding; the binding's type in
      // workers-types leaves out the scheduled handler that service_binding_extra_handlers adds.
      readonly TENTACLES: Fetcher & {
        scheduled(options: { cron: string; scheduledTime: Date }): Promise<{ outcome: string }>;
      };
      readonly LIFETIME: Fetcher;
      readonly SessionObject: DurableObjectNamespace<SessionRpc>;
      readonly RegistryObject: DurableObjectNamespace<RegistryRpc>;
    }
  }
}
