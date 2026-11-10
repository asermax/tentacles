import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // pi-claude-code ships TypeScript source, which Node does not strip inside node_modules.
    server: { deps: { inline: ["@earendil-works/pi-claude-code"] } },
  },
});
