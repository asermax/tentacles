import { parse } from "yaml";

const frontmatterPattern = /^(---[ \t]*\r?\n)(?:([\s\S]*?)(\r?\n))?(---[ \t]*(?:\r?\n|$))/;

const plainLinePattern = /^([A-Za-z0-9_][\w.-]*):[ \t]+(\S.*?)[ \t]*(\r?)$/;

const indentedPattern = /^[ \t]+\S/;

const isPlainValue = (value: string) => !/^["'|>]/.test(value);

const isInvalidAlone = (line: string) => {
  try {
    parse(line);

    return false;
  } catch {
    return true;
  }
};

// Claude Code accepts values that strict YAML rejects (`description: Does a
// thing: with a colon`, `argument-hint: [a] [b]`); quoting only the plain
// single-line values that fail on their own keeps their text and leaves every
// valid line as written.
const quoteFailingValues = (block: string) => {
  const lines = block.split("\n");

  return lines
    .map((line, index) => {
      const match = plainLinePattern.exec(line);

      if (match == null || !isPlainValue(match[2] ?? "")) {
        return line;
      }

      if (indentedPattern.test(lines[index + 1] ?? "") || !isInvalidAlone(line.trimEnd())) {
        return line;
      }

      return `${match[1]}: ${JSON.stringify(match[2])}${match[3]}`;
    })
    .join("\n");
};

/** A markdown text split into its frontmatter attributes and body; `text` is the text with its frontmatter repaired when strict YAML rejected it, otherwise the text as read. */
export interface Frontmatter {
  readonly attributes: unknown;
  readonly body: string;
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
    const repaired = quoteFailingValues(block);

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
