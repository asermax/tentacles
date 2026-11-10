import type { TestProject } from "vitest/node";

import { bundleWorker } from "./bundle-worker.ts";

declare module "vitest" {
  interface ProvidedContext {
    readonly workerModules: Awaited<ReturnType<typeof bundleWorker>>;
  }
}

/**
 * Bundles the Worker once per run. The plugin resolves its options once per test file, each with
 * its own Miniflare, so bundling there runs one build per file into the same directory, and a
 * Miniflare would load files another build is deleting or rewriting.
 */
export const setup = async (project: TestProject) => {
  project.provide("workerModules", await bundleWorker());

  project.onTestsRerun(async () => {
    project.provide("workerModules", await bundleWorker());
  });
};
