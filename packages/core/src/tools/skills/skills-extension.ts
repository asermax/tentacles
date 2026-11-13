import { defineExtension } from "@earendil-works/pi-durable";

import { skillTool } from "./skill-tool";
import { skillsSection } from "./skills-section";

/** The session's skills: the section that lists them and the tool that loads one by name. */
export const skillsExtension = defineExtension({
  name: "tentacles-skills",
  sections: [skillsSection],
  tools: [skillTool],
});
