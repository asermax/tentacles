import { lit, obj, str, union } from "@earendil-works/pi-schema";
import * as Schema from "effect/Schema";

/** What the preview tool gives back: the open preview's URLs, or the close. */
export const PreviewResult = Schema.Union([
  Schema.TaggedStruct("open", { url: Schema.String, cdpUrl: Schema.String }),
  Schema.TaggedStruct("close", {}),
]).pipe(Schema.toTaggedUnion("_tag"));

export type PreviewResult = typeof PreviewResult.Type;

/** PreviewResult's encoded form as pi-durable validates the tool's structured output. */
export const previewResultSchema = union([
  obj({
    _tag: lit("open"),
    url: str({ description: "The preview URL, reachable by Browser Run only through its token." }),
    cdpUrl: str({ description: "Pass to agent-browser as --cdp." }),
  }),
  obj({ _tag: lit("close") }),
]);
