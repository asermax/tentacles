import { readFileSync } from "node:fs";

import type { Harness } from "@tentacles/worker-api/parent";

import { assertCoverage, tokenPattern, type TokenMap } from "./coverage.ts";

const sharedDir = new URL("../src/shared/", import.meta.url);

const readShared = (name: string) => readFileSync(new URL(name, sharedDir), "utf8");

const frontmatter = [
  "---",
  "name: tentacles",
  "description: Send separable, long work to remote agents that run in tentacles, and steer, question and collect them.",
  "---",
  "",
].join("\n");

/** The skill sources one harness's skill is built from: the protocol and that harness's fragment. */
export const skillSources = (harness: Harness) => ({
  protocol: readShared("protocol.md"),
  map: { invoke: readShared(`invoke-${harness}.md`).trimEnd() } satisfies TokenMap,
});

/** The SKILL.md text: the protocol with each token replaced, checked against the map first. */
export const skillText = (protocol: string, map: TokenMap): string => {
  assertCoverage([protocol, ...Object.values(map)], map);

  return (
    frontmatter + protocol.replace(tokenPattern, (_placeholder, token: string) => map[token] ?? "")
  );
};
