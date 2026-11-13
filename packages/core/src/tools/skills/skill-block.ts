import { skillFolder } from "./skill-folder.ts";
import type { SkillEntry } from "./skills-doc.ts";

/** What the skill tool answers and a prompt expansion inserts: a pointer to the skill's SKILL.md. */
export const skillBlock = (skill: SkillEntry) =>
  `<skill name="${skill.name}" location="${skill.path}">\n` +
  `Read ${skill.path} before acting on this skill. Paths it names, such as references/ or scripts/, are relative to ${skillFolder(skill)}/.\n` +
  "</skill>";
