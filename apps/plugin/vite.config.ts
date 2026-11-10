import { defineConfig } from "vite";

// Three bundles, each one self-contained file: the helper as a Node CLI, the
// pi extension for Node, and the Claude mod, which runs with no Node and may
// import nothing outside its plugin but the engine's `claude-code` module.
// build/emit.ts lays them out with the manifests and the skill.
export default defineConfig({
  builder: {
    // Only the three named environments build; the default client one has no entry.
    buildApp: async (builder) => {
      for (const name of ["helper", "pi", "claude"]) {
        const environment = builder.environments[name];

        if (environment != null) {
          await builder.build(environment);
        }
      }
    },
  },
  logLevel: "warn",
  environments: {
    helper: {
      consumer: "server",
      resolve: { noExternal: true },
      build: {
        outDir: "dist/helper",
        emptyOutDir: true,
        minify: false,
        rolldownOptions: {
          input: "src/helper/cli.ts",
          output: {
            format: "es",
            entryFileNames: "tentacles-helper.js",
            banner: "#!/usr/bin/env node",
            codeSplitting: false,
          },
        },
      },
    },
    pi: {
      consumer: "server",
      resolve: { noExternal: true },
      build: {
        outDir: "dist/pi",
        emptyOutDir: true,
        minify: false,
        rolldownOptions: {
          input: "src/pi/extension.ts",
          preserveEntrySignatures: "strict",
          output: { format: "es", entryFileNames: "extension.js", codeSplitting: false },
        },
      },
    },
    claude: {
      consumer: "client",
      build: {
        outDir: "dist/claude",
        emptyOutDir: true,
        minify: false,
        modulePreload: false,
        rolldownOptions: {
          input: "src/claude/register.ts",
          external: ["claude-code"],
          preserveEntrySignatures: "strict",
          output: { format: "es", entryFileNames: "register.js", codeSplitting: false },
        },
      },
    },
  },
});
