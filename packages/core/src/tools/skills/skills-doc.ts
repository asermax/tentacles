import { defineDoc } from "@earendil-works/pi-durable";
import type { Skill } from "@tentacles/worker-api/definitions";

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
