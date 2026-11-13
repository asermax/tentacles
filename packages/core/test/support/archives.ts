import { randomBytes } from "node:crypto";

import * as Effect from "effect/Effect";
import { packTar } from "modern-tar";

/** One file of an archive fixture. */
export interface ArchiveFile {
  readonly path: string;
  readonly content: string | Uint8Array;
  readonly mode?: number;
}

/** A skill folder: its SKILL.md and the files beside it. */
export interface SkillFixture {
  readonly name: string;
  readonly description?: string;
  /** The folder the skill sits in, when it is not the skill's name. */
  readonly folder?: string;
  readonly body?: string;
  readonly files?: readonly ArchiveFile[];
}

/** An agent definition file. */
export interface AgentFixture {
  readonly name: string;
  readonly description?: string;
  readonly prompt: string;
}

const definition = (name: string, description: string, body: string) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`;

/** A tar.gz of the files, packed the way the plugin's helper packs one. */
export const packArchive = async (files: readonly ArchiveFile[]) => {
  const tar = await packTar(
    files.map((file) => ({
      header: {
        name: file.path,
        size: Buffer.byteLength(file.content),
        mode: file.mode ?? 0o644,
      },
      body: file.content,
    })),
  );

  const gzipped = new Blob([tar]).stream().pipeThrough(new CompressionStream("gzip"));

  return new Uint8Array(await new Response(gzipped).arrayBuffer());
};

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
      path: `${agent.name}.md`,
      content: definition(agent.name, agent.description ?? `The ${agent.name} agent`, agent.prompt),
    })),
  );

/** An agents archive whose only agent is frontmatter with no body. */
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

/** The skills `implement` and `review` and the agents `reviewer` and `planner`, packed. */
export const definitionArchives = () =>
  Effect.promise(async () => ({
    skills: await skillsArchive(...heldSkills),
    agents: await agentsArchive(...heldAgents),
  }));
