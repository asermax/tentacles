import { chmodSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Harness } from "@tentacles/worker-api/parent";
import * as Match from "effect/Match";
import * as Schema from "effect/Schema";

import { skillSources, skillText } from "./skill.ts";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));

const distDir = join(packageRoot, "dist");

export const outDir = join(packageRoot, "build", "out");

const { version } = Schema.decodeSync(
  Schema.fromJsonString(Schema.Struct({ version: Schema.String })),
)(readFileSync(join(packageRoot, "package.json"), "utf8"));

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

const EmitFile = Schema.Union([
  Schema.TaggedStruct("copy", {
    dest: Schema.String,
    from: Schema.String,
    isExecutable: Schema.optionalKey(Schema.Boolean),
  }),
  Schema.TaggedStruct("text", { dest: Schema.String, text: Schema.String }),
]).pipe(Schema.toTaggedUnion("_tag"));

type EmitFile = typeof EmitFile.Type;

const { copy, text } = EmitFile.cases;

const helper = (dest: string): EmitFile =>
  copy.make({
    dest,
    from: join(distDir, "helper", "tentacles-helper.js"),
    isExecutable: true,
  });

const readme = copy.make({ dest: "README.md", from: join(packageRoot, "README.md") });

const skillFile = (harness: Harness): EmitFile => {
  const { protocol, map } = skillSources(harness);

  return text.make({ dest: "skills/tentacles/SKILL.md", text: skillText(protocol, map) });
};

const filePlan = (harness: Harness): ReadonlyArray<EmitFile> =>
  harness === "pi"
    ? [
        text.make({ dest: "package.json", text: piManifest }),
        copy.make({ dest: "extension/index.js", from: join(distDir, "pi", "extension.js") }),
        helper("tentacles-helper"),
        skillFile(harness),
        readme,
      ]
    : [
        text.make({ dest: ".claude-plugin/plugin.json", text: claudeManifest }),
        copy.make({
          dest: "hooks/hooks.json",
          from: join(packageRoot, "src", "claude", "hooks.json"),
        }),
        copy.make({ dest: "hooks/register.js", from: join(distDir, "claude", "register.js") }),
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

    Match.valueTags(file, {
      text: ({ text: contents }) => writeFileSync(dest, contents),
      copy: ({ from, isExecutable }) => {
        copyFileSync(from, dest);

        if (isExecutable === true) {
          chmodSync(dest, 0o755);
        }
      },
    });
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  emitPlugin("pi", join(outDir, "pi"));
  emitPlugin("claude", join(outDir, "claude"));
}
