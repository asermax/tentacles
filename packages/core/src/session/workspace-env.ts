import type { ExecutionEnv } from "@earendil-works/pi-durable/env";
import type { RemoteExecutionEnv } from "@earendil-works/pi-env";

/**
 * An ExecutionEnv that opens the workspace on its first operation. pi-durable
 * calls env() for prompt section renders too, and those must not start the
 * container, so env() hands this out and the first command or file operation
 * of a tool call ensures the workspace. A failed open fails that operation
 * only, and the next one tries again.
 */
export const workspaceEnv = (
  id: string,
  cwd: string,
  open: () => Promise<RemoteExecutionEnv>,
): ExecutionEnv => {
  let opened: Promise<RemoteExecutionEnv> | undefined;

  const ready = () => {
    opened ??= open().catch((error: Error) => {
      opened = undefined;

      throw error;
    });

    return opened;
  };

  const use = async <A>(operation: (env: RemoteExecutionEnv) => Promise<A>) =>
    operation(await ready());

  return {
    id,
    cwd,
    absolutePath: (...args) => use((env) => env.absolutePath(...args)),
    joinPath: (...args) => use((env) => env.joinPath(...args)),
    readTextFile: (...args) => use((env) => env.readTextFile(...args)),
    openTextLineReader: (...args) => use((env) => env.openTextLineReader(...args)),
    readTextLines: (...args) => use((env) => env.readTextLines(...args)),
    readBinaryFile: (...args) => use((env) => env.readBinaryFile(...args)),
    openBinaryReader: (...args) => use((env) => env.openBinaryReader(...args)),
    writeFile: (...args) => use((env) => env.writeFile(...args)),
    appendFile: (...args) => use((env) => env.appendFile(...args)),
    truncateFile: (...args) => use((env) => env.truncateFile(...args)),
    flushFile: (...args) => use((env) => env.flushFile(...args)),
    renameFile: (...args) => use((env) => env.renameFile(...args)),
    fileInfo: (...args) => use((env) => env.fileInfo(...args)),
    listDir: (...args) => use((env) => env.listDir(...args)),
    listFiles: (...args) => use((env) => env.listFiles(...args)),
    openDirReader: (...args) => use((env) => env.openDirReader(...args)),
    watch: (...args) => use((env) => env.watch(...args)),
    canonicalPath: (...args) => use((env) => env.canonicalPath(...args)),
    exists: (...args) => use((env) => env.exists(...args)),
    createDir: (...args) => use((env) => env.createDir(...args)),
    remove: (...args) => use((env) => env.remove(...args)),
    createTempDir: (...args) => use((env) => env.createTempDir(...args)),
    createTempFile: (...args) => use((env) => env.createTempFile(...args)),
    exec: (...args) => use((env) => env.exec(...args)),
    // Cleaning up a workspace this env never opened has nothing to stop.
    cleanup: async (context) => {
      if (opened != null) {
        await (await opened).cleanup(context);
      }
    },
  };
};
