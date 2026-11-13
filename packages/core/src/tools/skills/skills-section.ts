import { section } from "@earendil-works/pi-durable";

import { type SkillEntry, SkillsDoc } from "./skills-doc.ts";

const listing = (skills: readonly SkillEntry[]) =>
  "Skills are instructions for specific kinds of work. When a task matches a skill's description, " +
  "load it with the skill tool before you start.\n\n" +
  skills
    .map(
      (skill) =>
        `<skill>\n<name>${skill.name}</name>\n<description>${skill.description}</description>\n<location>${skill.path}</location>\n</skill>`,
    )
    .join("\n");

export const skillsSection = section("available_skills", async (input, context) => {
  const skills = (await input.read.snapshot(SkillsDoc, context))?.skills ?? [];

  return skills.length === 0 ? undefined : listing(skills);
});
