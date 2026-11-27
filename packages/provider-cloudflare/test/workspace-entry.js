// The Workspace Worker's main module as the tests bundle it: the deployed module's exports, with
// the workspace object extended by the reads a test makes, which no operation of the deployed object
// answers.
import {
  WorkspaceObject as DeployedWorkspaceObject,
  WorkspaceProxy,
  WorkspaceServiceProxy,
} from "../src/workspace-worker.ts";

export { default } from "../src/workspace-worker.ts";

export { WorkspaceProxy, WorkspaceServiceProxy };

export class WorkspaceObject extends DeployedWorkspaceObject {
  // Every path under /workspace with its mode, and each file's text, as the object holds them.
  async files() {
    const exists = await this.workspace.fs.stat("/workspace").then(
      () => true,
      () => false,
    );

    if (!exists) {
      return [];
    }

    const found = await this.workspace.fs.find("/workspace", "**");

    return Promise.all(
      found
        .filter(({ type }) => type === "file")
        .map(async ({ path }) => {
          const stat = await this.workspace.fs.stat(path);

          return {
            path,
            mode: stat.mode & 0o777,
            size: stat.size,
            text: await this.workspace.fs.readFile(path, "utf8"),
          };
        }),
    );
  }
}
