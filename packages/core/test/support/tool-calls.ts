import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { Entry } from "@tentacles/worker-api/entries";
import type { SessionId } from "@tentacles/worker-api/ids";
import * as Effect from "effect/Effect";

import { TestWorld } from "./world";

/** The model's answer that calls a tool. */
export const toolUse = (name: string, args: Readonly<Record<string, string>>) =>
  fauxAssistantMessage(fauxToolCall(name, args), { stopReason: "toolUse" });

/** The tool results among a session's last entries, oldest first. */
export const toolResults = (sessionId: SessionId, count = 30) =>
  Effect.gen(function* () {
    const world = yield* TestWorld;

    return (yield* (yield* world.handle(sessionId)).messages(count)).filter(
      Entry.guards.toolResult,
    );
  });
