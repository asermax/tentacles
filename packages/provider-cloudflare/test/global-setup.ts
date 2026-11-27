import type { TestProject } from "vitest/node";

import { bundleWorkers } from "./bundle-worker";

declare module "vitest" {
  interface ProvidedContext {
    readonly workerModules: Awaited<ReturnType<typeof bundleWorkers>>["workerModules"];
    readonly workspaceModules: Awaited<ReturnType<typeof bundleWorkers>>["workspaceModules"];
  }
}

const provide = async (project: TestProject) => {
  const { workerModules, workspaceModules } = await bundleWorkers();

  project.provide("workerModules", workerModules);
  project.provide("workspaceModules", workspaceModules);
};

/**
 * Bundles both Workers once per run. The plugin resolves its options once per test file, each with
 * its own Miniflare, so bundling there runs one build per file into the same directory, and a
 * Miniflare would load files another build is deleting or rewriting.
 */
export const setup = async (project: TestProject) => {
  await provide(project);

  project.onTestsRerun(() => provide(project));
};
