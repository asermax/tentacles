import { randomBytes } from "node:crypto";

import { packArchive as packEntries } from "@tentacles/worker-api/archives";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";

export interface ArchiveFile {
  readonly path: string;
  readonly content: string | Uint8Array;
  readonly mode?: number;
}

/** A skill folder: its SKILL.md and the files beside it; `folder` is where the skill sits when that is not its name. */
export interface SkillFixture {
  readonly name: string;
  readonly description?: string;
  readonly folder?: string;
  readonly body?: string;
  readonly files?: readonly ArchiveFile[];
}

/** An agent file; `file` is its name without `.md` when that is not the agent's name. */
export interface AgentFixture {
  readonly name: string;
  readonly description?: string;
  readonly file?: string;
  readonly prompt: string;
}

/** The block a held skill expands to: where its SKILL.md is and what its relative paths resolve against. */
export const skillBlockOf = (name: string) =>
  `<skill name="${name}" location="/skills/${name}/SKILL.md">\n` +
  `Read /skills/${name}/SKILL.md before acting on this skill. Paths it names, such as references/ or scripts/, are relative to /skills/${name}/.\n` +
  "</skill>";

const definition = (name: string, description: string, body: string) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`;

const encoder = new TextEncoder();

/** A tar.gz of the files, packed the way the plugin's helper packs one. */
export const packArchive = (files: readonly ArchiveFile[]) =>
  Effect.runPromise(
    packEntries(
      files.map((file) => ({
        path: file.path,
        bytes: Predicate.isString(file.content) ? encoder.encode(file.content) : file.content,
        mode: file.mode ?? 0o644,
      })),
    ),
  );

export const skillFiles = (skill: SkillFixture): ArchiveFile[] => {
  const {
    name,
    description = `The ${name} skill`,
    folder = name,
    body = `Follow ${name}.`,
  } = skill;

  return [
    { path: `${folder}/SKILL.md`, content: definition(name, description, body) },
    ...(skill.files ?? []).map((file) => ({ ...file, path: `${folder}/${file.path}` })),
  ];
};

export const skillsArchive = (...skills: readonly SkillFixture[]) =>
  packArchive(skills.flatMap(skillFiles));

export const agentsArchive = (...agents: readonly AgentFixture[]) =>
  packArchive(
    agents.map((agent) => ({
      path: `${agent.file ?? agent.name}.md`,
      content: definition(agent.name, agent.description ?? `The ${agent.name} agent`, agent.prompt),
    })),
  );

export const agentWithoutBody = (name: string) =>
  packArchive([{ path: `${name}.md`, content: definition(name, `The ${name} agent`, "") }]);

/** A skills archive over the 5 MB limit that gzip cannot shrink below it. */
export const oversizedSkillsArchive = () =>
  skillsArchive({
    name: "bulky",
    files: [{ path: "filler.bin", content: randomBytes(6 * 1024 * 1024) }],
  });

const heldSkills: readonly SkillFixture[] = [
  { name: "implement", description: "Implement a change from its design" },
  { name: "review", description: "Review a change before it is merged" },
];

const heldAgents: readonly AgentFixture[] = [
  { name: "reviewer", description: "Reviews a change", prompt: "You review changes." },
  { name: "planner", description: "Plans a change", prompt: "You plan changes." },
];

/** The names of the skills and agents `definitionArchives` packs. */
export const definitionNames = {
  skills: heldSkills.map((skill) => skill.name),
  agents: heldAgents.map((agent) => agent.name),
};

export const definitionArchives = () =>
  Effect.promise(async () => ({
    skills: await skillsArchive(...heldSkills),
    agents: await agentsArchive(...heldAgents),
  }));
