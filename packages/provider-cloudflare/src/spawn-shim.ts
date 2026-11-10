// pi-env's Connection starts its daemon with node:child_process's spawn and talks over the child's
// stdin and stdout. workerd stubs spawn, so the Worker bundle aliases node:child_process to this
// module: spawn runs the daemon in the session object's container through ctx.container.exec and
// returns the parts of ChildProcess that Connection uses, backed by the exec streams. Nothing else
// in the bundle spawns processes.
import { Buffer } from "node:buffer";
import { EventEmitter } from "node:events";

type Exec = (args: ReadonlyArray<string>) => Promise<ExecProcess>;

// Several session objects can share an isolate, so each registers its exec under its own program
// name, which it passes to Connection as the command.
const execs = new Map<string, Exec>();

export const registerExec = (program: string, exec: Exec) => {
  execs.set(program, exec);
};

/** The encoding a stream's data events use, set by setEncoding after the stream exists. */
interface StreamEncoding {
  value: BufferEncoding | null;
}

const pump = async (
  stream: ReadableStream<Uint8Array> | null,
  target: EventEmitter,
  encoding: StreamEncoding,
) => {
  if (stream == null) {
    return;
  }

  for await (const chunk of stream) {
    const buffer = Buffer.from(chunk);

    target.emit("data", encoding.value == null ? buffer : buffer.toString(encoding.value));
  }
};

class ShimStdin extends EventEmitter {
  #writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  #pending: Array<Uint8Array> = [];
  #isEnded = false;

  attach(writer: WritableStreamDefaultWriter<Uint8Array> | null) {
    this.#writer = writer;
    this.#flush();
  }

  write(data: Uint8Array) {
    this.#pending.push(data);
    this.#flush();

    return true;
  }

  end() {
    this.#isEnded = true;
    this.#flush();
  }

  #flush() {
    const writer = this.#writer;

    if (writer == null) {
      return;
    }

    for (const data of this.#pending) {
      writer.write(data).catch((error) => this.emit("error", error));
    }

    this.#pending = [];

    if (this.#isEnded) {
      writer.close().catch(() => undefined);
    }
  }
}

class ShimStderr extends EventEmitter {
  readonly encoding: StreamEncoding = { value: null };

  setEncoding(encoding: BufferEncoding) {
    this.encoding.value = encoding;

    return this;
  }
}

class ShimChild extends EventEmitter {
  readonly stdin = new ShimStdin();
  readonly stdout = new EventEmitter();
  readonly stderr = new ShimStderr();
  process: ExecProcess | null = null;

  kill() {
    this.process?.kill();

    return true;
  }
}

export const spawn = (program: string, args: ReadonlyArray<string>) => {
  const child = new ShimChild();
  const exec = execs.get(program);

  if (exec == null) {
    queueMicrotask(() =>
      child.emit("error", new Error(`No container exec registered as ${program}`)),
    );

    return child;
  }

  exec(args).then(
    (started) => {
      child.process = started;
      child.stdin.attach(started.stdin?.getWriter() ?? null);

      void pump(started.stdout, child.stdout, { value: null });
      void pump(started.stderr, child.stderr, child.stderr.encoding);

      started.exitCode.then(
        (code) => {
          child.emit("exit", code);
          child.emit("close", code);
        },
        (error) => child.emit("error", error),
      );
    },
    (error) => child.emit("error", error),
  );

  return child;
};

// The alias replaces node:child_process for the whole bundle, and deploy-time code that the bundle
// carries but the Worker never runs imports these too.
const unavailable = (name: string) => () => {
  throw new Error(`node:child_process ${name} is not available in the Worker`);
};

export const exec = unavailable("exec");
export const execFile = unavailable("execFile");
export const execSync = unavailable("execSync");
export const execFileSync = unavailable("execFileSync");
export const spawnSync = unavailable("spawnSync");
export const fork = unavailable("fork");

export default { spawn, exec, execFile, execSync, execFileSync, spawnSync, fork };
