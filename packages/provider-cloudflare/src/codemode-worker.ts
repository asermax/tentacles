// The codemode Worker's main module, deployed as a Worker of its own: scripts run in its isolate,
// never on the session object's thread. Its object keeps no state between executions.
import { CodemodeSandboxDurableObject } from "@earendil-works/pi-codemode/cloudflare";

export class CodemodeSandbox extends CodemodeSandboxDurableObject {}

export default {
  fetch: () => new Response("Not found", { status: 404 }),
};
