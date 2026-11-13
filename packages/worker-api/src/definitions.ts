import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { parse } from "yaml";

const nameFormat =
  "name must be 1 to 64 lowercase letters, digits and hyphens, with no leading, trailing or doubled hyphen";

const descriptionLength = "description must be 1 to 1024 characters";

export const DefinitionName = Schema.String.check(
  Schema.isPattern(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: nameFormat }),
  Schema.isMaxLength(64, { message: nameFormat }),
);

export const DefinitionDescription = Schema.String.check(
  Schema.isMinLength(1, { message: "description is missing; it must be 1 to 1024 characters" }),
  Schema.isMaxLength(1024, { message: descriptionLength }),
);

const nameField = DefinitionName.annotateKey({ messageMissingKey: "name is missing" });

const descriptionField = DefinitionDescription.annotateKey({
  messageMissingKey: "description is missing; it must be 1 to 1024 characters",
});

export const Skill = Schema.Struct({
  name: nameField,
  description: descriptionField,
});

export type Skill = typeof Skill.Type;

export const Agent = Schema.Struct({
  name: nameField,
  description: descriptionField,
  prompt: Schema.String.check(Schema.isPattern(/\S/, { message: "body is empty" })),
});

export type Agent = typeof Agent.Type;

/** Something wrong with one definition, with the path as the caller knows it. */
export const Problem = Schema.Struct({
  path: Schema.String,
  message: Schema.String,
});

export type Problem = typeof Problem.Type;

export interface SkillSource {
  readonly folder: string;
  readonly path: string;
  readonly text: string;
}

export interface AgentSource {
  readonly path: string;
  readonly text: string;
}

const frontmatterPattern = /^(---[ \t]*\r?\n)(?:([\s\S]*?)(\r?\n))?(---[ \t]*(?:\r?\n|$))/;

const plainLinePattern = /^([A-Za-z0-9_][\w.-]*):[ \t]+(\S.*?)[ \t]*(\r?)$/;

const indentedPattern = /^[ \t]+\S/;

const isPlainValue = (value: string) => !/^["'|>]/.test(value);

// Claude Code accepts values that strict YAML rejects (`description: Does a
// thing: with a colon`, `argument-hint: [a] [b]`); quoting each plain
// single-line value keeps its text and makes the block strict-valid.
const quotePlainValues = (block: string) => {
  const lines = block.split("\n");

  return lines
    .map((line, index) => {
      const match = plainLinePattern.exec(line);

      if (match == null || !isPlainValue(match[2] ?? "")) {
        return line;
      }

      if (indentedPattern.test(lines[index + 1] ?? "")) {
        return line;
      }

      return `${match[1]}: ${JSON.stringify(match[2])}${match[3]}`;
    })
    .join("\n");
};

export interface Frontmatter {
  readonly attributes: unknown;
  readonly body: string;
  /** The text with its frontmatter repaired when strict YAML rejected it, otherwise the text as read. */
  readonly text: string;
}

/** Splits the leading `---` block off a markdown text; throws the strict YAML error when neither the block nor its repaired form is valid YAML. */
export const readFrontmatter = (text: string): Frontmatter => {
  const match = frontmatterPattern.exec(text);

  if (match == null) {
    return { attributes: {}, body: text, text };
  }

  const [whole, open = "", block = "", lineBreak = "", close = ""] = match;
  const body = text.slice(whole.length);

  try {
    return { attributes: parse(block) ?? {}, body, text };
  } catch (strict) {
    const repaired = quotePlainValues(block);

    try {
      return {
        attributes: parse(repaired) ?? {},
        body,
        text: `${open}${repaired}${lineBreak}${close}${body}`,
      };
    } catch {
      throw strict;
    }
  }
};

/** The text a definition is sent as: its frontmatter repaired when strict YAML rejects it; a text that is not valid even then comes back as it is. */
export const repairFrontmatter = (text: string) => {
  try {
    return readFrontmatter(text).text;
  } catch {
    return text;
  }
};

const decodeSkill = Schema.decodeUnknownResult(Skill);

const decodeAgent = Schema.decodeUnknownResult(Agent);

const messageOf = (error: Schema.SchemaError) => error.message.replace(/\s+/g, " ");

const readDefinition = (text: string) =>
  Result.try({
    try: () => readFrontmatter(text),
    catch: (cause) => `the frontmatter is not valid YAML: ${String(cause)}`,
  });

// Collects the first problem of each definition and the duplicate names; every
// definition is checked, so one call reports them all.
const check = <Item extends { readonly name: string }, Source extends { readonly path: string }>(
  sources: ReadonlyArray<Source>,
  decode: (source: Source) => Result.Result<Item, string>,
) => {
  const items: Array<Item> = [];
  const problems: Array<Problem> = [];
  const owners = new Map<string, string>();

  for (const source of sources) {
    const decoded = decode(source);

    if (Result.isFailure(decoded)) {
      problems.push({ path: source.path, message: decoded.failure });

      continue;
    }

    const owner = owners.get(decoded.success.name);

    if (owner != null) {
      problems.push({
        path: source.path,
        message: `name '${decoded.success.name}' is already used by ${owner}`,
      });

      continue;
    }

    owners.set(decoded.success.name, source.path);
    items.push(decoded.success);
  }

  return { items, problems };
};

/** Every skill rule: name format, name equals its folder, description length, unique names. */
export const checkSkills = (sources: ReadonlyArray<SkillSource>) => {
  const { items, problems } = check(sources, (source) =>
    Result.flatMap(readDefinition(source.text), ({ attributes }) =>
      Result.flatMap(Result.mapError(decodeSkill(attributes), messageOf), (skill) =>
        skill.name === source.folder
          ? Result.succeed(skill)
          : Result.fail(`name '${skill.name}' does not match the folder '${source.folder}'`),
      ),
    ),
  );

  return { skills: items, problems };
};

/** Every agent rule: the skill name and description rules, a body that is not empty, unique names. */
export const checkAgents = (sources: ReadonlyArray<AgentSource>) => {
  const { items, problems } = check(sources, (source) =>
    Result.flatMap(readDefinition(source.text), ({ attributes, body }) =>
      Result.mapError(decodeAgent({ ...Object(attributes), prompt: body }), messageOf),
    ),
  );

  return { agents: items, problems };
};
