import { defineDoc, defineExtension, defineTool, section } from "@earendil-works/pi-durable";
import { obj, str } from "@earendil-works/pi-schema";
import { skillsDirectory } from "@tentacles/contracts/workspace";
import type { Skill } from "@tentacles/worker-api/definitions";

import { ToolNames } from "./tool-names.ts";

/** A skill as the session keeps it: its definition and where its SKILL.md is in the workspace. */
export type SkillEntry = Skill & {
  readonly path: string;
};

/** The session's skills, written once at create. */
export const SkillsDoc = defineDoc<{ skills: SkillEntry[] }>({
  kind: "tentacles.skills",
  version: 1,
  scope: "session",
  initial: () => ({ skills: [] }),
  checkpointWhen: () => false,
});

/** What the skill tool answers and a prompt expansion inserts: a pointer to the skill's SKILL.md. */
export const skillBlock = (skill: SkillEntry) =>
  `<skill name="${skill.name}" location="${skill.path}">\n` +
  `Read ${skill.path} before acting on this skill. Paths it names, such as references/ or scripts/, are relative to ${skillsDirectory}/${skill.name}/.\n` +
  "</skill>";

const triggerPattern = /\/(?:skill:)?([a-z0-9]+(?:-[a-z0-9]+)*)/g;

/**
 * Replaces each `/skill:<name>` and `/<name>` of a held skill with its block;
 * any other text, a path or an unheld name, stays as written.
 */
export const expandSkills = (text: string, skills: readonly SkillEntry[]) =>
  skills.length === 0
    ? text
    : text.replace(triggerPattern, (trigger, name: string) => {
        const skill = skills.find((held) => held.name === name);

        return skill == null ? trigger : skillBlock(skill);
      });

const listing = (skills: readonly SkillEntry[]) =>
  "Skills are instructions for specific kinds of work. When a task matches a skill's description, " +
  "load it with the skill tool before you start.\n\n" +
  skills
    .map(
      (skill) =>
        `<skill>\n<name>${skill.name}</name>\n<description>${skill.description}</description>\n<location>${skill.path}</location>\n</skill>`,
    )
    .join("\n");

/** The session's skills: the section that lists them and the tool that loads one by name. */
export const skillsExtension = defineExtension({
  name: "tentacles-skills",
  sections: [
    section("available_skills", async (input, context) => {
      const skills = (await input.read.snapshot(SkillsDoc, context))?.skills ?? [];

      return skills.length === 0 ? undefined : listing(skills);
    }),
  ],
  tools: [
    defineTool({
      name: ToolNames.skill,
      description:
        "Load one of the skills listed in available_skills by name. It answers where the skill's " +
        "SKILL.md is; read that file before acting on the skill.",
      parameters: obj({ name: str({ description: "A skill name from available_skills." }) }),
      replay: "safe",
      execute: async (args, api, context) => {
        const skills = (await api.snapshot(SkillsDoc, context))?.skills ?? [];
        const skill = skills.find((held) => held.name === args.name);

        if (skill == null) {
          const names = skills.map((held) => held.name).join(", ");

          throw new Error(`No skill ${args.name}. Skills: ${names === "" ? "none" : names}`);
        }

        return { output: [{ type: "text" as const, text: skillBlock(skill) }] };
      },
    }),
  ],
});
