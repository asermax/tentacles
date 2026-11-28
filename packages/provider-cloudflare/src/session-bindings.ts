import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";

import { claudeObjectClass } from "./claude-names";
import { codemodeSandboxClass } from "./codemode-sandbox";
import type { CodemodeSandbox } from "./codemode-worker";
import { workspaceObjectClass } from "./workspace-names";
import type { WorkspaceObject } from "./workspace-worker";

/**
 * The Durable Object namespaces the tentacles Worker binds, by binding name. The codemode namespace
 * is bound by the deployed stack only; the test Worker has none.
 */
export interface SessionBindings {
  readonly [claudeObjectClass]: DurableObjectNamespace;
  readonly [codemodeSandboxClass]?: DurableObjectNamespace<CodemodeSandbox>;
  readonly [workspaceObjectClass]: DurableObjectNamespace<WorkspaceObject>;
}

const requiredBindingNames = [claudeObjectClass, workspaceObjectClass];

const hasRequiredNamespaces = (env: unknown): env is SessionBindings =>
  Predicate.isObject(env) && requiredBindingNames.every((name) => Predicate.hasProperty(env, name));

/** The Worker environment types every binding as `any`. This checks that the namespaces are bound and types them. */
export const sessionBindings = Cloudflare.WorkerEnvironment.pipe(
  Effect.filterOrElse(hasRequiredNamespaces, (env) =>
    Effect.die(
      new Error(
        `The Worker binds ${Object.keys(env).join(", ")}, but needs ${requiredBindingNames.join(", ")}`,
      ),
    ),
  ),
);
