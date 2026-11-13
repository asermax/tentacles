import { Harnesses } from "@tentacles/worker-api/parent";

import { createController } from "../core/controller";
import type { Glue } from "../core/glue";
import { LocalState } from "../core/local-state";
import { ToolEntry } from "../core/tool-table";
import { runHelperProcess, startWatchProcess } from "./helper-process";
import type { PiContext, PiExtensionApi } from "./pi-api";
import { readStateEntry, writeStateEntry } from "./state-entry";

export const statusWidgetKey = "tentacles";

export const wakeMessageType = "tentacles:wake";

/** The pi glue: tentacles_<name> tools, the status widget, wakes by sendMessage and the local state as a session entry. */
export const tentaclesExtension = (pi: PiExtensionApi): void => {
  // The watch's output arrives outside any handler, so the context of the
  // last session_start is the one the widget and the state entry use.
  let context: PiContext | undefined;

  const glue: Glue = {
    readState: async () =>
      context == null ? LocalState.make({ sessions: [] }) : readStateEntry(context),
    writeState: async (state) => writeStateEntry(pi, state),
    status: (line) => context?.ui.setWidget(statusWidgetKey, line == null ? undefined : [line]),
    wake: (text) =>
      pi.sendMessage(
        { customType: wakeMessageType, content: text, display: true },
        { triggerTurn: true },
      ),
    registerTool: (tool, run) =>
      pi.registerTool({
        name: `tentacles_${tool.name}`,
        label: `tentacles ${tool.name}`,
        description: tool.description,
        parameters: ToolEntry.$match(tool, {
          Endpoint: (endpoint) => endpoint.arguments,
          WatchOnly: () => ({ type: "object", properties: {} }),
        }),
        execute: async (_toolCallId, params, signal) => {
          const outcome = await run(params, signal);

          if (outcome.isError) {
            throw new Error(outcome.text);
          }

          return { content: [{ type: "text", text: outcome.text }], details: {} };
        },
      }),
    runHelper: runHelperProcess,
    watch: startWatchProcess,
  };

  const controller = createController(glue, Harnesses.pi);

  pi.on("session_start", (_event, ctx) => {
    context = ctx;
    // The start-up sync calls the Worker, which must not hold up the session.
    void controller
      .start({ parentSessionId: ctx.sessionManager.getSessionId(), isInteractive: ctx.hasUI })
      .catch(() => undefined);
  });

  pi.on("session_shutdown", () => controller.stop());
};

// pi loads an extension through its default export.
export default tentaclesExtension;
