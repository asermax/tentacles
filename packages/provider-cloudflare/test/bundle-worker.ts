import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

import cloudflare from "@alchemy.run/cloudflare-runtime/rolldown";
import { build } from "rolldown";

import { workspaceCompatibility } from "../src/workspace-compatibility";

const path = (relative: string) => join(import.meta.dirname, relative);

export const bundleDir = path("../dist/test-worker");

export const workspaceBundleDir = path("../dist/test-workspace-worker");

export const compatibility = {
  date: "2026-11-01",
  flags: ["nodejs_compat"],
};

const bundle = async (
  entryFile: string,
  outputDir: string,
  { date, flags }: typeof compatibility,
) => {
  await rm(outputDir, { recursive: true, force: true });

  await build({
    input: path(entryFile),
    external: ["lightningcss", "fsevents"],
    plugins: [
      cloudflare({
        compatibilityDate: date,
        compatibilityFlags: flags,
      }),
    ],
    checks: { unresolvedImport: false, ineffectiveDynamicImport: false },
    // Alchemy's own bundle defaults: runtime-only code paths, and .sql imported as text.
    transform: { define: { "globalThis.__ALCHEMY_RUNTIME__": "true" } },
    moduleTypes: { ".sql": "text" },
    experimental: { lazyBarrel: true },
    output: { dir: outputDir, entryFileNames: "worker.js", format: "esm" },
    logLevel: "warn",
  });

  // The entry first, then every chunk and asset it imports.
  const files = (await readdir(outputDir, { recursive: true, withFileTypes: true }))
    .filter((dirent) => dirent.isFile() && dirent.name !== "worker.js")
    .map((dirent) => join(dirent.parentPath, dirent.name));

  return [join(outputDir, "worker.js"), ...files].map((file) =>
    file.endsWith(".sql")
      ? { type: "Text" as const, path: file }
      : { type: "ESModule" as const, path: file },
  );
};

/**
 * Bundles the tentacles Worker and the Workspace Worker the way Alchemy does at deploy, so the
 * tests run what ships: Alchemy's and Effect's deploy-time modules are tree-shaken out, which
 * Vite's module runner cannot do.
 */
export const bundleWorkers = async () => {
  const [workerModules, workspaceModules] = await Promise.all([
    bundle("./entry.js", bundleDir, compatibility),
    bundle("./workspace-entry.js", workspaceBundleDir, workspaceCompatibility),
  ]);

  return { workerModules, workspaceModules };
};
