import { skillBlock } from "./skill-block.ts";
import type { SkillEntry } from "./skills-doc.ts";
import { triggerPattern } from "./trigger-pattern.ts";

/**
 * Replaces each `/skill:<name>` and `/<name>` of a held skill with its block.
 * A trigger counts only when whitespace or the start or end of the text is on
 * both sides, so one inside a path or a word, or with punctuation attached,
 * stays as written, like an unheld name.
 */
export const expandSkills = (text: string, skills: readonly SkillEntry[]) =>
  text.replace(triggerPattern, (trigger, name: string) => {
    const skill = skills.find((held) => held.name === name);

    return skill == null ? trigger : skillBlock(skill);
  });
