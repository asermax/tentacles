import { chmodSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type * as Schema from "effect/Schema";

import { skillSources, skillText, type Harness } from "./skill.ts";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));

const distDir = join(packageRoot, "dist");

export const outDir = join(packageRoot, "build", "out");

const { version } = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));

const description =
  "Spawn, steer, question and collect remote coding agents that run in tentacles.";

const json = (value: Schema.JsonObject) => `${JSON.stringify(value, null, 2)}\n`;

const piManifest = json({
  name: "pi-tentacles",
  version,
  description,
  type: "module",
  private: true,
  keywords: ["pi-package", "pi-extension"],
  pi: {
    extensions: ["./extension/index.js"],
    skills: ["./skills"],
  },
});

const claudeManifest = json({ name: "tentacles", version, description });

type EmitFile =
  | { readonly dest: string; readonly from: string; readonly executable?: boolean }
  | { readonly dest: string; readonly text: string };

const helper = (dest: string): EmitFile => ({
  dest,
  from: join(distDir, "helper", "tentacles-helper.js"),
  executable: true,
});

const readme: EmitFile = { dest: "README.md", from: join(packageRoot, "README.md") };

const skillFile = (harness: Harness): EmitFile => {
  const { protocol, map } = skillSources(harness);

  return { dest: "skills/tentacles/SKILL.md", text: skillText(protocol, map) };
};

const filePlan = (harness: Harness): ReadonlyArray<EmitFile> =>
  harness === "pi"
    ? [
        { dest: "package.json", text: piManifest },
        { dest: "extension/index.js", from: join(distDir, "pi", "extension.js") },
        helper("tentacles-helper"),
        skillFile(harness),
        readme,
      ]
    : [
        { dest: ".claude-plugin/plugin.json", text: claudeManifest },
        { dest: "hooks/hooks.json", from: join(packageRoot, "src", "claude", "hooks.json") },
        { dest: "hooks/register.js", from: join(distDir, "claude", "register.js") },
        helper("bin/tentacles-helper"),
        skillFile(harness),
        readme,
      ];

/** Lays out one harness's plugin under `root` from the bundles in dist/; the skill is checked before anything is written. */
export const emitPlugin = (harness: Harness, root: string): void => {
  const plan = filePlan(harness);

  rmSync(root, { recursive: true, force: true });

  for (const file of plan) {
    const dest = join(root, file.dest);

    mkdirSync(dirname(dest), { recursive: true });

    if ("text" in file) {
      writeFileSync(dest, file.text);
    } else {
      copyFileSync(file.from, dest);

      if (file.executable === true) {
        chmodSync(dest, 0o755);
      }
    }
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  emitPlugin("pi", join(outDir, "pi"));
  emitPlugin("claude", join(outDir, "claude"));
}
