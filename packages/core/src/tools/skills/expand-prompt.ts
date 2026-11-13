import { expandSkills } from "./expand-skills.ts";
import type { SkillEntry } from "./skills-doc.ts";
import { triggerPattern } from "./trigger-pattern.ts";

/**
 * Expands the held skills' triggers in a prompt, reading the skills document
 * only when a held name is triggered: matching needs the names alone.
 */
export const expandPrompt = async (
  text: string,
  heldNames: readonly string[],
  readSkills: () => Promise<readonly SkillEntry[]>,
) =>
  [...text.matchAll(triggerPattern)].some((match) => heldNames.includes(match[1] ?? ""))
    ? expandSkills(text, await readSkills())
    : text;
