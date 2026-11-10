import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

import { bundleDir, bundleWorker, compatibility } from "./test/bundle-worker.ts";
import { testSecrets } from "./test/secrets.ts";

const workerName = "tentacles";

// Every outbound request the Worker makes ends here, answered with what it received, so a test
// reads the forwarded request from the response.
const echo = async (request: Request) =>
  Response.json({
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers),
  });

const objects = ["SessionObject", "RegistryObject", "ClaudeObject"] as const;

// The Worker runs as its own Miniflare worker, from the bundle Alchemy would upload, and the tests
// reach it through bindings. Inside the test runner the plugin wraps Durable Objects in a class
// that answers RPC only for methods their prototype declares, while Alchemy's objects answer
// every method through a Proxy.
export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const modules = await bundleWorker();

      return {
        miniflare: {
          compatibilityDate: compatibility.date,
          compatibilityFlags: compatibility.flags,
          serviceBindings: { TENTACLES: workerName },
          durableObjects: Object.fromEntries(
            objects.map((name) => [name, { className: name, scriptName: workerName }]),
          ),
          workers: [
            {
              name: workerName,
              modules,
              modulesRoot: bundleDir,
              compatibilityDate: compatibility.date,
              compatibilityFlags: compatibility.flags,
              bindings: testSecrets,
              durableObjects: Object.fromEntries(
                objects.map((name) => [name, { className: name, useSQLite: true }]),
              ),
              serviceBindings: { AI: echo, BROWSER: echo },
              outboundService: echo,
            },
          ],
        },
      };
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
  },
});
