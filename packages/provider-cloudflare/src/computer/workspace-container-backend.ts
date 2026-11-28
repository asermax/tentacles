import type { BackendHandle } from "@cloudflare/computer";
import {
  ContainerBackend,
  type ContainerBackendOptions,
} from "@cloudflare/computer/backends/container";

interface GitIdentity {
  readonly name: string;
  readonly email: string;
}

// Where the image's entrypoint installs the CA the platform intercepts outbound HTTPS with.
const interceptionCaPath = "/usr/local/share/ca-certificates/cloudflare-containers-ca.crt";

const commandEnvironment = ({ name, email }: GitIdentity) => ({
  GIT_AUTHOR_NAME: name,
  GIT_AUTHOR_EMAIL: email,
  GIT_COMMITTER_NAME: name,
  GIT_COMMITTER_EMAIL: email,
  NODE_EXTRA_CA_CERTS: interceptionCaPath,
  // Node reads its own CA list, not the system store the entrypoint updates.
});

/**
 * Computer's container backend, with the deploy's git identity and the setting that makes Node trust
 * the interception CA in the environment of every command it runs. computerd gives a command nothing
 * but HOME and PATH, so both have to travel with each exec; they come after the caller's own
 * variables, which cannot override them.
 */
export class WorkspaceContainerBackend extends ContainerBackend {
  readonly #commandEnvironment: Record<string, string>;

  constructor(options: ContainerBackendOptions, identity: GitIdentity) {
    super(options);
    this.#commandEnvironment = commandEnvironment(identity);
  }

  override async connect(): Promise<BackendHandle> {
    const backendHandle = await super.connect();
    const { shell, sync } = backendHandle.rpc;

    return {
      ...backendHandle,
      rpc: {
        sync,
        shell: {
          exec: (execRequest) =>
            shell.exec({
              ...execRequest,
              env: { ...execRequest.env, ...this.#commandEnvironment },
            }),
          getExec: (execLookup) => shell.getExec(execLookup),
          killExec: (killRequest) => shell.killExec(killRequest),
          disposeExec: (disposeRequest) => shell.disposeExec(disposeRequest),
        },
      },
      close: () => backendHandle.close(),
    };
  }
}
