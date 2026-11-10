import * as Schema from "effect/Schema";

import { ParentSessionId } from "./ids.ts";

export const Harnesses = {
  pi: "pi",
  claude: "claude",
} as const;

export const Harness = Schema.Enum(Harnesses);

export type Harness = typeof Harness.Type;

export const Parent = Schema.Struct({
  harness: Harness,
  sessionId: ParentSessionId,
});

export type Parent = typeof Parent.Type;
