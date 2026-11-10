import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

export interface OpenedBrowser {
  /** The URL agent-browser connects to. */
  readonly cdpUrl: string;
}

/** A managed browser the agent drives over CDP, only to validate a preview; closing none is not an error. */
export class Browser extends Context.Service<
  Browser,
  {
    readonly open: () => Effect.Effect<OpenedBrowser>;
    readonly close: () => Effect.Effect<void>;
  }
>()("tentacles/Browser") {}
