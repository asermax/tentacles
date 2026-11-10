import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

import cloudflare from "@alchemy.run/cloudflare-runtime/rolldown";
import { build } from "rolldown";

const path = (relative: string) => join(import.meta.dirname, relative);

export const bundleDir = path("../dist/test-worker");

export const compatibility = {
  date: "2026-11-01",
  flags: ["nodejs_compat"],
};

/**
 * Bundles the Worker the way Alchemy does at deploy, so the tests run what ships: Alchemy's and
 * Effect's deploy-time modules are tree-shaken out, which Vite's module runner cannot do.
 */
export const bundleWorker = async () => {
  const dir = bundleDir;

  await rm(dir, { recursive: true, force: true });

  await build({
    input: path("./entry.js"),
    external: ["lightningcss", "fsevents"],
    resolve: {
      alias: {
        "node:child_process": path("../src/spawn-shim.ts"),
      },
    },
    plugins: [
      cloudflare({
        compatibilityDate: compatibility.date,
        compatibilityFlags: compatibility.flags,
      }),
    ],
    checks: { unresolvedImport: false, ineffectiveDynamicImport: false },
    // Alchemy's own bundle defaults: runtime-only code paths, and .sql imported as text.
    transform: { define: { "globalThis.__ALCHEMY_RUNTIME__": "true" } },
    moduleTypes: { ".sql": "text" },
    experimental: { lazyBarrel: true },
    output: { dir, entryFileNames: "worker.js", format: "esm" },
    logLevel: "warn",
  });

  // The entry first, then every chunk and asset it imports.
  const files = (await readdir(dir, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name !== "worker.js")
    .map((entry) => join(entry.parentPath, entry.name));

  return [join(dir, "worker.js"), ...files].map((file) =>
    file.endsWith(".sql")
      ? { type: "Text" as const, path: file }
      : { type: "ESModule" as const, path: file },
  );
};
