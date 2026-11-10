/** A placeholder in the skill sources: `{{` + name + `}}`. */
export const tokenPattern = /\{\{(\w+)\}\}/g;

export type TokenMap = Readonly<Record<string, string>>;

const placeholdersIn = (text: string) =>
  [...text.matchAll(tokenPattern)].map((match) => match[1] ?? "");

/**
 * Fails when the token map and the skill sources disagree, in either
 * direction: a token the map defines that no source uses, or a placeholder a
 * source uses that the map does not define.
 */
export const assertCoverage = (sources: ReadonlyArray<string>, map: TokenMap): void => {
  const used = new Set(sources.flatMap(placeholdersIn));
  const defined = new Set(Object.keys(map));

  for (const token of defined) {
    if (!used.has(token)) {
      throw new Error(`The token {{${token}}} has a fragment, but no skill source uses it.`);
    }
  }

  for (const token of used) {
    if (!defined.has(token)) {
      throw new Error(`The skill sources use {{${token}}}, but no fragment defines it.`);
    }
  }
};
