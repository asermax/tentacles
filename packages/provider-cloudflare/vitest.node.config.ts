import { defineConfig } from "vitest/config";

// Tests that run the workspace's code in Node with a fake container: the Worker's runner cannot
// load Alchemy's container module, and node:child_process is the shim the bundle also aliases.
export default defineConfig({
  resolve: { alias: { "node:child_process": `${import.meta.dirname}/src/spawn-shim.ts` } },
  test: {
    include: ["test/**/*.node.test.ts"],
    // Inlined so the alias reaches the node:child_process import in pi-env's client.
    server: { deps: { inline: ["@earendil-works/pi-env"] } },
  },
});
