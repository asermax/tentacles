import { nameGrammar } from "@tentacles/worker-api/definitions";

export const triggerPattern = new RegExp(`(?<=^|\\s)/(?:skill:)?(${nameGrammar})(?=\\s|$)`, "g");
