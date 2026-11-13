import * as Record from "effect/Record";

/**
 * The kinds of archive a create request carries. `expandsInto` is where the workspace container
 * expands the kind's archive; a null one is read by the Worker only and never reaches the container.
 */
export const archiveKinds = {
  skills: { heading: "Skills", expandsInto: "/skills" },
  agents: { heading: "Agents", expandsInto: null },
  context: { heading: "Context", expandsInto: "/context" },
} as const;

export type ArchiveKind = keyof typeof archiveKinds;

/** The kinds in table order. */
export const archiveKindNames = Record.keys(archiveKinds);

/** The kinds the workspace container expands, each with its directory, in table order. */
export const archiveExpansions = archiveKindNames.flatMap((kind) => {
  const { expandsInto } = archiveKinds[kind];

  return expandsInto == null ? [] : [{ kind, directory: expandsInto }];
});
