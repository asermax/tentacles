import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

import { bundleDir, compatibility, workspaceBundleDir } from "./test/bundle-worker";
import { echo } from "./test/echo";
import { githubFixture } from "./test/github-fixture";
import { scriptedModel } from "./test/scripted-model";
import { testSecrets } from "./test/secrets";
import { workspaceCompatibility } from "./src/workspace-compatibility";
import { workspaceObjectClass, workspaceWorkerName } from "./src/workspace-names";

const tentaclesWorkerName = "tentacles";

const workspaceBinding = { className: workspaceObjectClass, scriptName: workspaceWorkerName };

const objectClasses = ["SessionObject", "RegistryObject", "ClaudeObject"] as const;

// The Browser binding of the Workspace Worker: it records the sessions the gateway connects to and
// refuses them, so a test reads which session a signed token reached.
const browserStubSource = `
import { WorkerEntrypoint } from "cloudflare:workers";

const connectedSessionIds = [];

export default class BrowserStub extends WorkerEntrypoint {
  async connectSession(sessionId) {
    connectedSessionIds.push(sessionId);

    throw new Error("The test browser has no sessions");
  }

  async connectedSessions() {
    return connectedSessionIds;
  }
}
`;

const browserStubName = "browser-stub";

const tentaclesSecrets = {
  TENTACLES_API_KEY: testSecrets.TENTACLES_API_KEY,
  TENTACLES_CLAUDE_TOKEN: testSecrets.TENTACLES_CLAUDE_TOKEN,
  TENTACLES_CDP_SECRET: testSecrets.TENTACLES_CDP_SECRET,
};

const workspaceSecrets = {
  TENTACLES_CDP_SECRET: testSecrets.TENTACLES_CDP_SECRET,
  TENTACLES_GITHUB_TOKEN: testSecrets.TENTACLES_GITHUB_TOKEN,
  TENTACLES_GIT_AUTHOR_NAME: testSecrets.TENTACLES_GIT_AUTHOR_NAME,
  TENTACLES_GIT_AUTHOR_EMAIL: testSecrets.TENTACLES_GIT_AUTHOR_EMAIL,
};

// The tentacles Worker and the Workspace Worker run as their own Miniflare workers, from the bundles
// Alchemy would upload, and the tests reach them through bindings. GATEWAY is the container's
// gateway as the workspace object hands it to the container, and the Workspace Worker's LOADER is
// the Worker Loader Computer's isolate shell runs on. Inside the test runner the plugin wraps Durable Objects in a class
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
                TENTACLES: tentaclesWorkerName,
                GATEWAY: { name: workspaceWorkerName, props: { isGateway: true } },
                BROWSER_STUB: browserStubName,
              },
              durableObjects: {
                ...Object.fromEntries(
                  objectClasses.map((name) => [
                    name,
                    { className: name, scriptName: tentaclesWorkerName },
                  ]),
                ),
                [workspaceObjectClass]: workspaceBinding,
              },
              workers: [
                {
                  name: tentaclesWorkerName,
                  modules: inject("workerModules"),
                  modulesRoot: bundleDir,
                  compatibilityDate: compatibility.date,
                  compatibilityFlags: compatibility.flags,
                  bindings: tentaclesSecrets,
                  durableObjects: {
                    ...Object.fromEntries(
                      objectClasses.map((name) => [name, { className: name, useSQLite: true }]),
                    ),
                    [workspaceObjectClass]: workspaceBinding,
                  },
                  serviceBindings: { AI: scriptedModel, BROWSER: echo },
                  outboundService: echo,
                },
                {
                  name: workspaceWorkerName,
                  modules: inject("workspaceModules"),
                  modulesRoot: workspaceBundleDir,
                  compatibilityDate: workspaceCompatibility.date,
                  compatibilityFlags: workspaceCompatibility.flags,
                  bindings: workspaceSecrets,
                  durableObjects: {
                    [workspaceObjectClass]: { className: workspaceObjectClass, useSQLite: true },
                  },
                  workerLoaders: { LOADER: {} },
                  serviceBindings: { BROWSER: browserStubName },
                  outboundService: githubFixture(),
                },
                {
                  name: browserStubName,
                  modules: true,
                  script: browserStubSource,
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
