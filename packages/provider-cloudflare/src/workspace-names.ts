/** The Workspace Worker's script name; the tentacles Worker binds its class by it. */
export const workspaceWorkerName = "tentacles-workspace";

/** The class the Workspace Worker exports, and the name of the binding to it. */
export const workspaceObjectClass = "WorkspaceObject";

/** The Workspace Worker's Worker Loader binding, which Computer's isolate shell runs on. */
export const workspaceLoaderBinding = "LOADER";

/** The header the session object marks a preview request with, naming the port it is for. */
export const previewPortHeader = "x-tentacles-preview-port";

/** The ids the workspace object registers its exec backends under, which the exec tool names. */
export const workspaceBackends = { shell: "shell", container: "container" } as const;

/** The workspace container's id: the deploy publishes the image under it and Computer starts it by it. */
export const workspaceContainerId = "WorkspaceContainer";
