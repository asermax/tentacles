import { defineTool } from "@earendil-works/pi-durable";
import { int, lit, obj, union } from "@earendil-works/pi-schema";
import { Browser, type BrowserUnavailable } from "@tentacles/contracts/browser";
import { PreviewRouter } from "@tentacles/contracts/preview-router";
import { RegistryStore, type RegistryUnavailable } from "@tentacles/contracts/registry-store";
import type { SessionId } from "@tentacles/worker-api/ids";
import * as Effect from "effect/Effect";

import { ToolNames } from "./tool-names.ts";

/** Runs a preview step with the services the session holds. */
export type PreviewRunner = <A>(
  effect: Effect.Effect<
    A,
    BrowserUnavailable | RegistryUnavailable,
    Browser | PreviewRouter | RegistryStore
  >,
) => Promise<A>;

type PreviewResult =
  | { readonly action: "open"; readonly url: string; readonly cdpUrl: string }
  | { readonly action: "close" };

const text = (result: PreviewResult) => ({
  output: [{ type: "text" as const, text: JSON.stringify(result) }],
});

// The browser opens before the preview is recorded, so a failed store closes
// it and a failed browser leaves no token behind.
const open = (
  sessionId: SessionId,
  port: number,
): Effect.Effect<
  PreviewResult,
  BrowserUnavailable | RegistryUnavailable,
  Browser | PreviewRouter | RegistryStore
> =>
  Effect.gen(function* () {
    const browser = yield* Browser;
    const registry = yield* RegistryStore;
    const router = yield* PreviewRouter;

    yield* browser.close();

    const opened = yield* browser.open();

    const preview = yield* registry
      .openPreview(sessionId, port)
      .pipe(Effect.tapErrorTag("RegistryUnavailable", () => browser.close()));

    const result: PreviewResult = {
      action: "open",
      url: yield* router.url(preview.token),
      cdpUrl: opened.cdpUrl,
    };

    return result;
  });

const close = (
  sessionId: SessionId,
): Effect.Effect<PreviewResult, RegistryUnavailable, Browser | RegistryStore> =>
  Effect.gen(function* () {
    yield* (yield* Browser).close();
    yield* (yield* RegistryStore).closePreview(sessionId);

    const result: PreviewResult = { action: "close" };

    return result;
  });

/** The preview tool: opens the session's one preview, replacing an open one, or closes it. */
export const previewTool = (sessionId: SessionId, run: PreviewRunner) =>
  defineTool({
    name: ToolNames.preview,
    description:
      "Open a preview of a server you started in /workspace, to check it in a browser, or close it. " +
      "Opening returns the preview URL and a cdpUrl to pass to agent-browser with --cdp; opening " +
      "again replaces the open preview. Close it when you are done. Check APIs from the workspace " +
      "itself, without a preview.",
    parameters: union([
      obj({
        action: lit("open"),
        port: int({ description: "The port the server listens on in the workspace." }),
      }),
      obj({ action: lit("close") }),
    ]),
    execute: async (args) =>
      text(await run(args.action === "open" ? open(sessionId, args.port) : close(sessionId))),
  });
