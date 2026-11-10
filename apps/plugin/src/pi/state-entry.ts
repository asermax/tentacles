import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { LocalState } from "../core/local-state.ts";
import type { PiContext, PiExtensionApi } from "./pi-api.ts";

export const stateEntryType = "tentacles-state";

const decodeState = Schema.decodeUnknownOption(LocalState);

/** The local state is the last tentacles entry on the session's branch, so a fork starts from its parent's. */
export const readStateEntry = (ctx: PiContext): LocalState => {
  const entry = ctx.sessionManager
    .getBranch()
    .findLast(
      (candidate) => candidate.type === "custom" && candidate.customType === stateEntryType,
    );

  return Option.getOrElse(decodeState(entry?.data), () => LocalState.make({ sessions: [] }));
};

export const writeStateEntry = (pi: PiExtensionApi, state: LocalState) =>
  pi.appendEntry(stateEntryType, Schema.encodeSync(LocalState)(state));
