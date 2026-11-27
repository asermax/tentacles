import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

import { bundleDir, compatibility, workspaceBundleDir } from "./test/bundle-worker";
import { githubFixture } from "./test/github-fixture";
import { scriptedModel } from "./test/scripted-model";
import { testSecrets } from "./test/secrets";
import { workspaceWorkerName } from "./src/workspace-names";

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

const workspaceObject = "WorkspaceObject";

// The Browser binding of the Workspace Worker: it records the sessions the gateway connects to and
// refuses them, so a test reads which session a signed token reached.
const browserStub = `
import { WorkerEntrypoint } from "cloudflare:workers";

const connected = [];

export default class BrowserStub extends WorkerEntrypoint {
  async connectSession(sessionId) {
    connected.push(sessionId);

    throw new Error("The test browser has no sessions");
  }

  async connectedSessions() {
    return connected;
  }
}
`;

const browserStubName = "browser-stub";

const workspaceSecrets = {
  TENTACLES_CDP_SECRET: testSecrets.TENTACLES_CDP_SECRET,
  TENTACLES_GITHUB_TOKEN: testSecrets.TENTACLES_GITHUB_TOKEN,
  TENTACLES_GIT_AUTHOR_NAME: testSecrets.TENTACLES_GIT_AUTHOR_NAME,
  TENTACLES_GIT_AUTHOR_EMAIL: testSecrets.TENTACLES_GIT_AUTHOR_EMAIL,
};

// The tentacles Worker and the Workspace Worker run as their own Miniflare workers, from the bundles
// Alchemy would upload, and the tests reach them through bindings. Inside the test runner the plugin wraps Durable Objects in a class
// that answers RPC only for methods their prototype declares, while Alchemy's objects answer
// every method through a Proxy.
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          cloudflareTest(({ inject }) => ({
            miniflare: {
              compatibilityDate: compatibility.date,
              // The cron test calls the Worker's scheduled handler through its service binding.
              compatibilityFlags: [...compatibility.flags, "service_binding_extra_handlers"],
              serviceBindings: {
                TENTACLES: workerName,
                // The container's gateway, as the workspace object hands it to the container.
                GATEWAY: { name: workspaceWorkerName, props: { gateway: "test-workspace" } },
                BROWSER_STUB: browserStubName,
              },
              durableObjects: {
                ...Object.fromEntries(
                  objects.map((name) => [name, { className: name, scriptName: workerName }]),
                ),
                [workspaceObject]: { className: workspaceObject, scriptName: workspaceWorkerName },
              },
              workers: [
                {
                  name: workerName,
                  modules: inject("workerModules"),
                  modulesRoot: bundleDir,
                  compatibilityDate: compatibility.date,
                  compatibilityFlags: compatibility.flags,
                  bindings: testSecrets,
                  durableObjects: {
                    ...Object.fromEntries(
                      objects.map((name) => [name, { className: name, useSQLite: true }]),
                    ),
                    [workspaceObject]: {
                      className: workspaceObject,
                      scriptName: workspaceWorkerName,
                    },
                  },
                  serviceBindings: { AI: scriptedModel, BROWSER: echo },
                  outboundService: echo,
                },
                {
                  name: workspaceWorkerName,
                  modules: inject("workspaceModules"),
                  modulesRoot: workspaceBundleDir,
                  compatibilityDate: compatibility.date,
                  compatibilityFlags: compatibility.flags,
                  bindings: workspaceSecrets,
                  durableObjects: {
                    [workspaceObject]: { className: workspaceObject, useSQLite: true },
                  },
                  // Computer's isolate shell runs on a Worker Loader.
                  workerLoaders: { LOADER: {} },
                  serviceBindings: { BROWSER: browserStubName },
                  outboundService: githubFixture(),
                },
                {
                  name: browserStubName,
                  modules: true,
                  script: browserStub,
                  compatibilityDate: compatibility.date,
                },
              ],
            },
          })),
        ],
        test: {
          name: "worker",
          include: ["test/**/*.test.ts"],
          globalSetup: ["test/global-setup.ts"],
        },
      },
    ],
  },
});
