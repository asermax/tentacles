import { builtinModules } from "node:module";

import { defineConfig } from "vite";

// One Node ESM file the Claude image runs: pi-claude-code ships TypeScript source, which Node does not
// strip inside node_modules, so every dependency is bundled.
export default defineConfig({
  build: {
    ssr: "src/main.ts",
    target: "node24",
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: { entryFileNames: "main.js" },
    },
  },
  ssr: {
    noExternal: true,
    external: [...builtinModules, ...builtinModules.map((name) => `node:${name}`)],
  },
});
