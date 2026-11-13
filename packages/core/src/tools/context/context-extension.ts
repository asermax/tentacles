import { defineExtension } from "@earendil-works/pi-durable";

import { contextSection } from "./context-section";

/** The context files the parent sent: the section that says where they are. */
export const contextExtension = defineExtension({
  name: "tentacles-context",
  sections: [contextSection],
});
