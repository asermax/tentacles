import { PreviewRouter, PreviewToken } from "@tentacles/contracts/preview-router";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { zone } from "./hosts.ts";

// A first-level name under the zone, so Universal SSL covers it and the zone's wildcard record
// resolves it.
const previewSuffix = `-tentacles-preview.${zone}`;

const decodeToken = Schema.decodeUnknownOption(PreviewToken);

/** The Worker route that sends every preview host to the Worker. */
export const previewRoute = `*${previewSuffix}/*`;

export const isPreviewHost = (host: string) => host.endsWith(previewSuffix);

/** The token a preview host names; none when the part before the suffix is not a token. */
export const previewTokenOf = (host: string): Option.Option<PreviewToken> =>
  decodeToken(host.slice(0, -previewSuffix.length));

export const CloudflarePreviewRouter = Layer.succeed(
  PreviewRouter,
  PreviewRouter.of({
    url: (token) => Effect.succeed(`https://${token}${previewSuffix}`),
  }),
);
