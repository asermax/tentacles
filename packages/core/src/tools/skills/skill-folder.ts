import { skillsDirectory } from "@tentacles/contracts/workspace";
import type { Skill } from "@tentacles/worker-api/definitions";

export const skillFolder = (skill: Skill) => `${skillsDirectory}/${skill.name}`;
