import { defineDoc, defineExtension, defineTool, section } from "@earendil-works/pi-durable";
import { obj, str } from "@earendil-works/pi-schema";
import { skillsDirectory } from "@tentacles/contracts/workspace";
import { skillFile } from "@tentacles/worker-api/archives";
import { nameGrammar, type Skill } from "@tentacles/worker-api/definitions";

import { findNamed } from "./find-named.ts";
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

const skillFolder = (skill: Skill) => `${skillsDirectory}/${skill.name}`;

/** A skill with its place in the workspace, where the archive's extraction puts its folder. */
export const toSkillEntry = (skill: Skill): SkillEntry => ({
  ...skill,
  path: `${skillFolder(skill)}/${skillFile}`,
});

/** What the skill tool answers and a prompt expansion inserts: a pointer to the skill's SKILL.md. */
export const skillBlock = (skill: SkillEntry) =>
  `<skill name="${skill.name}" location="${skill.path}">\n` +
  `Read ${skill.path} before acting on this skill. Paths it names, such as references/ or scripts/, are relative to ${skillFolder(skill)}/.\n` +
  "</skill>";

const triggerPattern = new RegExp(`(?<=^|\\s)/(?:skill:)?(${nameGrammar})(?=\\s|$)`, "g");

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

        return {
          output: [
            {
              type: "text" as const,
              text: skillBlock(
                findNamed({ singular: "skill", plural: "Skills" }, skills, args.name),
              ),
            },
          ],
        };
      },
    }),
  ],
});
