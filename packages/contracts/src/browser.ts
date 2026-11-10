import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export interface OpenedBrowser {
  /** The URL agent-browser connects to. */
  readonly cdpUrl: string;
}

/** No browser could be opened. */
export class BrowserUnavailable extends Schema.TaggedError<BrowserUnavailable>()(
  "BrowserUnavailable",
  { message: Schema.String },
) {}

/** A managed browser the agent drives over CDP, only to validate a preview; closing none is not an error. */
export class Browser extends Context.Service<
  Browser,
  {
    readonly open: () => Effect.Effect<OpenedBrowser, BrowserUnavailable>;
    readonly close: () => Effect.Effect<void>;
  }
>()("tentacles/Browser") {}
