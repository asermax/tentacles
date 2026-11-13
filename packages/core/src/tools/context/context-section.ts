import { section } from "@earendil-works/pi-durable";
import { contextDirectory } from "@tentacles/contracts/workspace";

import { ContextDoc } from "./context-doc";

export const contextSection = section("context", async (input, context) =>
  (await input.read.snapshot(ContextDoc, context))?.sent === true
    ? `The parent sent files for context. They are in ${contextDirectory}.`
    : undefined,
);
