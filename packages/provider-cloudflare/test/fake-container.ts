import { Buffer } from "node:buffer";

export interface RecordedExec {
  readonly command: ReadonlyArray<string>;
  readonly options: ContainerExecOptions | undefined;
}

const requestFrame = 1;
const resultFrame = 2;

interface Hello {
  readonly protocol: number;
  readonly os: string;
  readonly arch: string;
}

const frame = (type: number, id: number, json: Hello) => {
  const body = Buffer.from(JSON.stringify(json), "utf8");
  const header = Buffer.alloc(13);

  header.writeUInt32BE(9 + body.length, 0);
  header.writeUInt8(type, 4);
  header.writeUInt32BE(id, 5);
  header.writeUInt32BE(body.length, 9);

  return Buffer.concat([header, body]);
};

// What pi-env's client needs to treat the daemon as started: the sync line with the token it
// passed, then the answer to its hello request.
const daemonProcess = (command: ReadonlyArray<string>): ExecProcess => {
  const token = command[command.indexOf("--token") + 1];
  const output = new TransformStream<Uint8Array, Uint8Array>();
  const writer = output.writable.getWriter();
  const exit = Promise.withResolvers<number>();

  return {
    stdin: new WritableStream<Uint8Array>({
      write: async (chunk) => {
        if (chunk[4] !== requestFrame) {
          return;
        }

        const id = Buffer.from(chunk).readUInt32BE(5);

        await writer.write(Buffer.from(`PI-ENV ${token}\n`));
        await writer.write(frame(resultFrame, id, { protocol: 1, os: "linux", arch: "x64" }));
      },
    }),
    stdout: output.readable,
    stderr: null,
    pid: 1,
    isPty: false,
    exitCode: exit.promise,
    output: () => Promise.reject(new Error("The fake daemon has no buffered output")),
    kill: () => exit.resolve(0),
    resize: () => undefined,
  };
};

const unused = () => {
  throw new Error("The fake container does not implement this");
};

const finishedProcess: ExecProcess = {
  stdin: null,
  stdout: null,
  stderr: null,
  pid: 2,
  isPty: false,
  exitCode: Promise.resolve(0),
  output: () =>
    Promise.resolve({ stdout: new ArrayBuffer(0), stderr: new ArrayBuffer(0), exitCode: 0 }),
  kill: () => undefined,
  resize: () => undefined,
};

/**
 * A container that is stopped until start is called and answers the daemon's hello, recording the
 * options of each exec and of the start.
 */
export const fakeContainer = (image: string) => {
  const execs: Array<RecordedExec> = [];
  const starts: Array<ContainerStartupOptions | undefined> = [];
  let running = false;

  const container: Container = {
    get running() {
      return running;
    },
    images: { WorkspaceContainer: image },
    start: (options) => {
      starts.push(options);
      running = true;
    },
    exec: async (command, options) => {
      execs.push({ command, options });

      return command[0] === "/usr/local/bin/pi-env" ? daemonProcess(command) : finishedProcess;
    },
    setInactivityTimeout: () => Promise.resolve(),
    interceptOutboundHttp: () => Promise.resolve(),
    interceptOutboundHttps: () => Promise.resolve(),
    interceptAllOutboundHttp: unused,
    monitor: unused,
    destroy: unused,
    signal: unused,
    getTcpPort: unused,
    snapshotContainer: unused,
    inspect: unused,
  };

  return { container, execs, starts };
};
