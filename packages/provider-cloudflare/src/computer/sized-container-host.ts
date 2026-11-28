import type {
  ContainerHostHolder,
  ContainerInstanceSize,
  IWorkspaceContainerAPI,
} from "@cloudflare/computer/backends/container";

/**
 * A container host whose launches ask for the instance size `size` answers when the container
 * starts, not when the backend was built: Computer's container backend keeps the size it was given
 * at construction, which is before a session's setup has stored the one it asked for.
 */
export const sizedContainerHost = (
  host: IWorkspaceContainerAPI,
  size: () => ContainerInstanceSize,
): IWorkspaceContainerAPI => ({
  start: (spec) => host.start({ ...spec, instance: size() }),
  restart: (spec) => host.restart({ ...spec, instance: size() }),
  interceptOutboundHttp: (hostname, workspace) => host.interceptOutboundHttp(hostname, workspace),
  interceptAllOutboundHttp: (workspace, token) => host.interceptAllOutboundHttp(workspace, token),
  fetchPort: (port, requestOrUrl, init) => host.fetchPort(port, requestOrUrl, init),
  port: (port) => host.port(port),
  setInactivityTimeout: (durationMs) => host.setInactivityTimeout(durationMs),
  status: () => host.status(),
  exitInfo: () => host.exitInfo(),
});

/** The holder Computer's container backend dials, over a holder that answers the host. */
export const sizedContainerHolder = (
  holder: ContainerHostHolder,
  size: () => ContainerInstanceSize,
): ContainerHostHolder => ({
  getWorkspaceContainer: async () => sizedContainerHost(await holder.getWorkspaceContainer(), size),
});
