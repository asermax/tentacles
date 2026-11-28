import { RemoteCodemodeSandbox } from "@earendil-works/pi-codemode/portable";
import { CodeSandbox } from "@tentacles/contracts/code-sandbox";
import type { SessionId } from "@tentacles/worker-api/ids";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import type { CodemodeSandbox } from "./codemode-worker";

/** The codemode Worker's script name; the tentacles Worker binds its class by it. */
export const codemodeWorkerName = "tentacles-codemode";

/** The class the codemode Worker exports, and the name of the binding to it. */
export const codemodeSandboxClass = "CodemodeSandbox";

// The deployed stack binds the sandbox namespace; a Worker without it fails the script that needs it.
const sandboxStub = (
  sandboxes: DurableObjectNamespace<CodemodeSandbox> | undefined,
  sessionId: SessionId,
) => {
  if (sandboxes == null) {
    throw new Error(`The Worker has no ${codemodeSandboxClass} binding`);
  }

  return sandboxes.getByName(sessionId);
};

/** CodeSandbox for one session: its scripts run in the codemode Worker's object named after it. */
export const codeSandboxLayer = (
  sandboxes: DurableObjectNamespace<CodemodeSandbox> | undefined,
  sessionId: SessionId,
) =>
  Layer.succeed(
    CodeSandbox,
    CodeSandbox.of({
      sandbox: () =>
        Effect.succeed(
          new RemoteCodemodeSandbox({ remote: () => sandboxStub(sandboxes, sessionId) }),
        ),
    }),
  );
