import { SessionId } from "@tentacles/worker-api/ids";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as FetchHttpClient from "effect/http/FetchHttpClient";

import { CommandResultJson, HelperError, WatchLineJson } from "../core/helper-output.ts";
import { NodeWebSocketConstructor } from "./client.ts";
import { isCommandName, runCommand } from "./command.ts";
import { watchSessions } from "./watch.ts";

const encodeResult = Schema.encodeSync(CommandResultJson);

const encodeLine = Schema.encodeSync(WatchLineJson);

const decodeSessionIds = Schema.decodeUnknownEffect(Schema.Array(SessionId));

// The glue runs `<command> <arguments as JSON>` per tool call and reads the
// one result line; `watch <session id>...` prints a line per state until it
// is killed.
const main = (argv: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const [name = "", ...rest] = argv;

    if (name === "watch") {
      const sessionIds = yield* decodeSessionIds(rest);

      return yield* watchSessions(sessionIds, (line) => Console.log(encodeLine(line)));
    }

    const result = isCommandName(name)
      ? yield* runCommand(name, rest[0] ?? "{}")
      : HelperError.make({ message: `Unknown command "${name}".` });

    return yield* Console.log(encodeResult(result));
  });

void Effect.runPromise(
  main(process.argv.slice(2)).pipe(
    Effect.catch((error) =>
      Console.log(encodeResult(HelperError.make({ message: String(error) }))),
    ),
    Effect.provide([FetchHttpClient.layer, NodeWebSocketConstructor]),
  ),
);
