import { archiveKinds } from "@tentacles/worker-api/archive-kinds";
import type { Skill } from "@tentacles/worker-api/definitions";

export const skillFolder = (skill: Skill) => `${archiveKinds.skills.expandsInto}/${skill.name}`;
