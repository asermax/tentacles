import { skillFile } from "@tentacles/worker-api/archives";
import type { Skill } from "@tentacles/worker-api/definitions";

import { skillFolder } from "./skill-folder";
import type { SkillEntry } from "./skills-doc";

/** A skill with its place in the workspace, where the archive's extraction puts its folder. */
export const toSkillEntry = (skill: Skill): SkillEntry => ({
  ...skill,
  path: `${skillFolder(skill)}/${skillFile}`,
});
