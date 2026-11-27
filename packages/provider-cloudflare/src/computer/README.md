# Computer adapters

The code that adapts Cloudflare Computer 0.11.4 to this setup lives in this folder, so a Computer upgrade is reviewed here. Each adapter replaces or wraps one Computer API and says why in its own module.

- `workspace-container-backend.ts`, `WorkspaceContainerBackend`: extends Computer's `ContainerBackend` and wraps the `shell.exec` of the handle its `connect` returns. computerd gives a command nothing but HOME and PATH, so the wrapper adds the deploy's git identity and `NODE_EXTRA_CA_CERTS` to the environment of every command, after the caller's own variables. Depends on `connect` returning `rpc.shell` and `rpc.sync`.
- `sized-container-host.ts`, `sizedContainerHost` and `sizedContainerHolder`: wrap the container host Computer's `ContainerBackend` dials. The backend fixes its instance type when it is built, before a session's setup has stored the size, so the wrapper adds the stored size to every `start` and `restart`. Depends on `IWorkspaceContainerAPI` having exactly the members it forwards.
- `workspace-tools.ts`, `workspaceTools`: wraps the pi tools of `createPiTools` as pi-durable registrations (replay mode, abort signal, content as output) and replaces its `exec`, which returns only when a command ends, with one that reads the client's `runtime.exec` events, so output reaches the live view line by line, kills the command on abort and flags a non-zero exit as an error, which Computer reports as a success. Depends on the `exec` declaration, the `execute` signature and the `runtime.exec` event names.

There is no index module: each adapter is imported from its own file, because the container adapters load Computer's container backend, which needs the Workers runtime, while the stack loads the tools in Node.
