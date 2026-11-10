import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

/** A preview's token, generated when the preview opens. */
export const PreviewToken = Schema.String.check(Schema.isUUID()).pipe(Schema.brand("PreviewToken"));

export type PreviewToken = typeof PreviewToken.Type;

/** Public URLs for previews. */
export class PreviewRouter extends Context.Service<
  PreviewRouter,
  {
    readonly url: (token: PreviewToken) => Effect.Effect<string>;
  }
>()("tentacles/PreviewRouter") {}
