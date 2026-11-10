import type { CodemodeSandboxBase } from "@earendil-works/pi-codemode";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

/** The sandbox codemode scripts run in, as pi-durable's codemode extension takes it. */
export class CodeSandbox extends Context.Service<
  CodeSandbox,
  {
    readonly sandbox: () => Effect.Effect<CodemodeSandboxBase>;
  }
>()("tentacles/CodeSandbox") {}
