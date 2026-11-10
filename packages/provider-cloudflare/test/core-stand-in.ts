// Stands in for @tentacles/core until it is merged into this branch: core's inbound surface as the
// program design declares it, so the provider typechecks and its routes run in the tests. Every
// session operation dies; list answers no sessions and the preview handler answers 404, which is
// what core answers on an empty registry.
import type { Browser } from "@tentacles/contracts/browser";
import type { CodeSandbox } from "@tentacles/contracts/code-sandbox";
import type { ModelProviders } from "@tentacles/contracts/model-providers";
import type { ParentChannel } from "@tentacles/contracts/parent-channel";
import type { PreviewRouter, PreviewToken } from "@tentacles/contracts/preview-router";
import type { RegistryStore } from "@tentacles/contracts/registry-store";
import type { SessionHost } from "@tentacles/contracts/session-host";
import type { SessionStorage } from "@tentacles/contracts/session-storage";
import type { WakeTimer } from "@tentacles/contracts/wake-timer";
import type { Workspace } from "@tentacles/contracts/workspace";
import { TentaclesApi } from "@tentacles/worker-api/api";
import type { SessionId } from "@tentacles/worker-api/ids";
import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/http-api";

type HostMember = Exclude<keyof SessionHost["Service"], "connect">;

type WithoutSessionId<F> = F extends (sessionId: SessionId, ...rest: infer Rest) => infer R
  ? (...rest: Rest) => R
  : never;

export type SessionHandle = {
  readonly [K in HostMember]: WithoutSessionId<SessionHost["Service"][K]>;
} & {
  readonly wake: () => Effect.Effect<void>;
  readonly workspaceNeeded: (pendingWork: boolean) => Effect.Effect<boolean>;
};

const notMerged = Effect.die(new Error("@tentacles/core is not merged yet"));

export const SessionsHandlersLive = HttpApiBuilder.group(TentaclesApi, "sessions", (handlers) =>
  handlers
    .handle("create", () => notMerged)
    .handle("prompt", () => notMerged)
    .handle("answer", () => notMerged)
    .handle("close", () => notMerged)
    .handle("messages", () => notMerged)
    .handle("status", () => notMerged)
    .handle("list", () => Effect.succeed([]))
    .handle("socket", () => notMerged),
);

export const Session = {
  make: (_input: {
    readonly sessionId: SessionId;
  }): Effect.Effect<
    SessionHandle,
    never,
    | SessionStorage
    | WakeTimer
    | ParentChannel
    | Workspace
    | Browser
    | PreviewRouter
    | RegistryStore
    | ModelProviders
    | CodeSandbox
  > => notMerged,
};

export const previewHandler = (
  _token: PreviewToken,
  _request: Request,
): Effect.Effect<Response, never, RegistryStore | SessionHost> =>
  Effect.succeed(new Response("Not found", { status: 404 }));

export const cleanup = (): Effect.Effect<void, never, RegistryStore | SessionHost> => Effect.void;
