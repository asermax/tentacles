import { execFileSync } from "node:child_process";
import { accessSync, constants, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import * as Schema from "effect/Schema";
import { createBuilder } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assertCoverage } from "../build/coverage";
import { emitPlugin } from "../build/emit";
import { skillSources, skillText } from "../build/skill";
import { CommandResultJson } from "../src/core/helper-output";
import { helperErrorMessage } from "./values";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));

const out = mkdtempSync(join(tmpdir(), "tentacles-plugin-build-"));

const read = (...path: ReadonlyArray<string>) => readFileSync(join(out, ...path), "utf8");

const readJson = <S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  ...path: ReadonlyArray<string>
) => Schema.decodeSync(Schema.fromJsonString(schema))(read(...path));

const PiManifest = Schema.Struct({ pi: Schema.Unknown });

const ClaudeManifest = Schema.Struct({ name: Schema.String });

const HooksFile = Schema.Struct({ modules: Schema.Unknown });

const expectSpawnSection = (skill: string) => {
  expect(skill).toContain("`skills`, the paths of skill folders on your machine");
  expect(skill).toContain("`agents`, the paths of agent definition files");
  expect(skill).toContain("Skills and agents are fixed at spawn.");
  expect(skill).toContain(
    "returns every problem with its path, the skills' problems in one group and the agents' in another",
  );
  expect(skill).toContain("## Context files");
  expect(skill).toContain("`/context/<file name>`");
  expect(skill).toContain("fixed at spawn");
  expect(skill).not.toMatch(/mahou/i);
};

const isExecutable = (...path: ReadonlyArray<string>) => {
  try {
    accessSync(join(out, ...path), constants.X_OK);

    return true;
  } catch {
    return false;
  }
};

beforeAll(async () => {
  const builder = await createBuilder({
    root: packageRoot,
    configFile: join(packageRoot, "vite.config.ts"),
  });

  await builder.buildApp();
  emitPlugin("pi", join(out, "pi"));
  emitPlugin("claude", join(out, "claude"));
}, 120_000);

afterAll(() => rmSync(out, { recursive: true, force: true }));

describe("plugin build", () => {
  it("emits the pi package with its manifest, the extension, the helper and the skill with pi's fragment", () => {
    const manifest = readJson(PiManifest, "pi", "package.json");
    const skill = read("pi", "skills", "tentacles", "SKILL.md");

    expect(manifest.pi).toEqual({ extensions: ["./extension/index.js"], skills: ["./skills"] });
    expect(read("pi", "extension", "index.js")).toContain("export {");
    expect(isExecutable("pi", "tentacles-helper")).toBe(true);
    expect(skill).toContain(
      readFileSync(join(packageRoot, "src", "shared", "invoke-pi.md"), "utf8").trimEnd(),
    );
    expect(skill).not.toContain("{{");
    expectSpawnSection(skill);
  });

  it("emits the Claude plugin with its manifest, the mod, the helper and the skill with Claude's fragment", () => {
    const manifest = readJson(ClaudeManifest, "claude", ".claude-plugin", "plugin.json");
    const hooks = readJson(HooksFile, "claude", "hooks", "hooks.json");
    const mod = read("claude", "hooks", "register.js");
    const skill = read("claude", "skills", "tentacles", "SKILL.md");

    expect(manifest.name).toBe("tentacles");
    expect(hooks.modules).toEqual(["./register.js"]);
    expect(mod).toContain("export { register }");
    expect(mod).not.toMatch(/^\s*import\s/m);
    expect(mod).not.toMatch(/\brequire\(/);
    expect(isExecutable("claude", "bin", "tentacles-helper")).toBe(true);
    expect(skill).toContain(
      readFileSync(join(packageRoot, "src", "shared", "invoke-claude.md"), "utf8").trimEnd(),
    );
    expect(skill).not.toContain("{{");
    expectSpawnSection(skill);
  });

  it("bundles a helper that runs on its own and prints its result line", () => {
    const printed = execFileSync(join(out, "claude", "bin", "tentacles-helper"), ["list", "{}"], {
      env: { PATH: process.env.PATH ?? "" },
    }).toString();

    expect(helperErrorMessage(Schema.decodeSync(CommandResultJson)(printed.trim()))).toContain(
      "TENTACLES_URL",
    );
  });
});

describe("skill sources", () => {
  it("fails the build when a source uses a token no fragment defines", () => {
    const { protocol, map } = skillSources("pi");

    expect(() => skillText(`${protocol}\n{{fleet}}\n`, map)).toThrow(
      "The skill sources use {{fleet}}, but no fragment defines it.",
    );
  });

  it("fails the build when a fragment defines a token no source uses", () => {
    expect(() => assertCoverage(["# Remote agents"], { invoke: "Use the tools." })).toThrow(
      "The token {{invoke}} has a fragment, but no skill source uses it.",
    );
  });
});
