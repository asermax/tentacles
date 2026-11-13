import { defineTool } from "@earendil-works/pi-durable";
import { obj, str } from "@earendil-works/pi-schema";

import { findNamed } from "../find-named";
import { ToolNames } from "../tool-names";
import { skillBlock } from "./skill-block";
import { SkillsDoc } from "./skills-doc";

export const skillTool = defineTool({
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
          text: skillBlock(findNamed({ singular: "skill", plural: "Skills" }, skills, args.name)),
        },
      ],
    };
  },
});
