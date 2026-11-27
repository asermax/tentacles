import type { BackendHandle } from "@cloudflare/computer";
import {
  ContainerBackend,
  type ContainerBackendOptions,
} from "@cloudflare/computer/backends/container";

interface GitIdentity {
  readonly name: string;
  readonly email: string;
}

const gitEnvironment = ({ name, email }: GitIdentity) => ({
  GIT_AUTHOR_NAME: name,
  GIT_AUTHOR_EMAIL: email,
  GIT_COMMITTER_NAME: name,
  GIT_COMMITTER_EMAIL: email,
});

/**
 * Computer's container backend, with the deploy's git identity in the environment of every command
 * it runs. computerd gives a command nothing but HOME and PATH, so the identity has to travel with
 * each exec; it comes after the caller's own variables, which cannot override it.
 */
export class IdentifiedContainerBackend extends ContainerBackend {
  readonly #gitEnvironment: Record<string, string>;

  constructor(options: ContainerBackendOptions, identity: GitIdentity) {
    super(options);
    this.#gitEnvironment = gitEnvironment(identity);
  }

  override async connect(): Promise<BackendHandle> {
    const backendHandle = await super.connect();
    const { shell, sync } = backendHandle.rpc;

    return {
      ...backendHandle,
      rpc: {
        sync,
        shell: {
          exec: (input) => shell.exec({ ...input, env: { ...input.env, ...this.#gitEnvironment } }),
          getExec: (input) => shell.getExec(input),
          killExec: (input) => shell.killExec(input),
          disposeExec: (input) => shell.disposeExec(input),
        },
      },
      close: () => backendHandle.close(),
    };
  }
}
