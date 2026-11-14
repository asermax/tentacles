import type { AssistantMessage } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "@effect/vitest";
import { Entry } from "@tentacles/worker-api/entries";
import { InvalidArchive } from "@tentacles/worker-api/errors";
import { SessionId } from "@tentacles/worker-api/ids";
import { SessionState } from "@tentacles/worker-api/session-state";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { createBody, post, serveApi } from "./support/api";
import { contextArchive, definitionArchives, definitionNames } from "./support/archives";
import { eventually } from "./support/eventually";
import { createRequest, detailsOf, parent } from "./support/fixtures";
import { type ModelRequest, routedModel } from "./support/model";
import { newSessionId, TestWorld, testWorld } from "./support/world";

const decodeCreated = Schema.decodeUnknownSync(Schema.Struct({ sessionId: SessionId }));
const decodeInvalidArchive = Schema.decodeUnknownSync(InvalidArchive);
const decodeState = Schema.decodeUnknownSync(SessionState);

const json = (response: Response) => Effect.promise(() => response.json());

const say = (text: string) => fauxAssistantMessage(text);

const toolUse = (name: string, args: Readonly<Record<string, string>>) =>
  fauxAssistantMessage(fauxToolCall(name, args), { stopReason: "toolUse" });

const sentence = "<context>\nThe parent sent files for context. They are in /context.\n</context>";

const files = () =>
  contextArchive(
    { path: "notes.md", content: "# notes\n" },
    { path: "scratch/plan.md", content: "the plan\n" },
    { path: "scratch/run.sh", content: "#!/bin/sh\necho ran\n", mode: 0o755 },
  );

const startSession = (
  answer: (request: ModelRequest) => AssistantMessage | Promise<AssistantMessage>,
  archives: Parameters<typeof createRequest>[2],
) =>
  Effect.gen(function* () {
    const world = yield* TestWorld;
    const sessionId = newSessionId();
    const handle = yield* world.handle(sessionId);

    world.faux.setResponses(routedModel(answer));
    yield* handle.create(createRequest("go", null, archives));

    return { sessionId, handle, world };
  });

const finished = (sessionId: SessionId, states = 2) =>
  Effect.gen(function* () {
    const world = yield* TestWorld;

    yield* eventually(
      Effect.sync(() => expect(world.records(sessionId).states).toHaveLength(states)),
    );
  });

const resultsOf = (sessionId: SessionId) =>
  Effect.gen(function* () {
    const world = yield* TestWorld;

    return (yield* (yield* world.handle(sessionId)).messages(100)).filter(Entry.guards.toolResult);
  });

describe("create with context", () => {
  it.live("a valid context archive is stored as sent and the root's prompt names /context", () =>
    Effect.gen(function* () {
      const context = yield* Effect.promise(files);
      const sections: Array<string | undefined> = [];

      const { sessionId, world } = yield* startSession(
        (request) => {
          sections.push(request.sections.get("context"));

          return say("seen");
        },
        { context },
      );

      yield* finished(sessionId);

      expect(world.archives("context").get(sessionId)).toEqual(context);
      expect(sections[0]).toBe(sentence);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a create without context stores no archive and renders no context section", () =>
    Effect.gen(function* () {
      const sections: Array<string | undefined> = [];

      const { sessionId, world } = yield* startSession((request) => {
        sections.push(request.sections.get("context"));

        return say("seen");
      }, {});

      yield* finished(sessionId);

      expect(world.archives("context").size).toBe(0);
      expect(sections.every((section) => section == null)).toBe(true);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a context archive that is not a gzip tar fails InvalidArchive and stores nothing", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const api = yield* serveApi;

      world.faux.setResponses([say("never")]);

      const response = yield* api(
        "/sessions",
        post(
          createBody({
            ...createRequest("go"),
            context: crypto.getRandomValues(new Uint8Array(512)),
          }),
        ),
      );

      expect(response.status).toBe(400);
      expect(decodeInvalidArchive(yield* json(response)).message).toContain("context archive");
      expect(world.registryCalls).toEqual([]);
      expect(world.archives("context").size).toBe(0);
      expect(world.faux.getPendingResponseCount()).toBe(1);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("invalid skills and context archives come back in one InvalidArchive", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const api = yield* serveApi;

      world.faux.setResponses([say("never")]);

      const response = yield* api(
        "/sessions",
        post(
          createBody({
            ...createRequest("go"),
            skills: crypto.getRandomValues(new Uint8Array(512)),
            context: crypto.getRandomValues(new Uint8Array(512)),
          }),
        ),
      );

      const { message } = decodeInvalidArchive(yield* json(response));

      expect(response.status).toBe(400);
      expect(message).toContain("skills archive");
      expect(message).toContain("context archive");
      expect(world.archives("context").size).toBe(0);
      expect(world.archives("skills").size).toBe(0);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("with skills and context both are stored and the registry entry names only skills", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const api = yield* serveApi;
      const archives = yield* definitionArchives();
      const context = yield* Effect.promise(files);
      const request = createRequest("go", null, { skills: archives.skills, context });

      world.faux.setResponses([say("ok")]);

      const response = yield* api("/sessions", post(createBody(request)));

      expect(response.status).toBe(200);

      const { sessionId } = decodeCreated(yield* json(response));
      const named = detailsOf(request, { skills: definitionNames.skills });

      yield* finished(sessionId);

      expect(world.archives("skills").get(sessionId)).toEqual(archives.skills);
      expect(world.archives("context").get(sessionId)).toEqual(context);
      expect(yield* json(yield* api(`/sessions?harness=pi&sessionId=${parent.sessionId}`))).toEqual(
        [{ sessionId, name: "worker", status: "idle", ...named }],
      );
      expect(decodeState(yield* json(yield* api(`/sessions/${sessionId}/status`)))).toEqual(
        SessionState.cases.idle.make(named),
      );
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a child and a grandchild see the context section", () =>
    Effect.gen(function* () {
      const context = yield* Effect.promise(files);
      const seen = new Map<string, string | undefined>();

      const { sessionId } = yield* startSession(
        (request) => {
          if (isGrandchild(request)) {
            seen.set("grandchild", request.sections.get("context"));

            return say("grandchild done");
          }

          if (!isRoot(request)) {
            if (!seen.has("child")) {
              seen.set("child", request.sections.get("context"));
            }
          }

          if (request.lastRole === "toolResult") {
            return say(isRoot(request) ? "Done." : "child done");
          }

          return toolUse("subagent", {
            action: "run",
            task: isRoot(request) ? "start a subagent" : "start another",
          });
        },
        { context },
      );

      yield* eventually(
        Effect.gen(function* () {
          const world = yield* TestWorld;
          const entries = yield* (yield* world.handle(sessionId)).messages(100);

          expect(entries).toContainEqual(Entry.cases.text.make({ text: "Done." }));
        }),
      );

      expect(Object.fromEntries(seen)).toEqual({ child: sentence, grandchild: sentence });
    }).pipe(Effect.provide(testWorld)),
  );
});

const isRoot = (request: ModelRequest) => request.tools.has("ask_parent");

const isGrandchild = (request: ModelRequest) => !request.tools.has("subagent");

const bash = (command: string) => toolUse("bash", { command });

describe("the context in the workspace", () => {
  it.live("a cold start expands the files under /context by name with their modes", () =>
    Effect.gen(function* () {
      const context = yield* Effect.promise(files);

      const { sessionId } = yield* startSession(
        (request) =>
          request.lastRole === "toolResult"
            ? say("looked")
            : bash(
                "cat /context/notes.md /context/scratch/plan.md; /context/scratch/run.sh; stat -c '%a' /context/scratch/run.sh /context/notes.md",
              ),
        { context },
      );

      yield* finished(sessionId);

      const [result] = yield* resultsOf(sessionId);

      expect(result?.isError).toBe(false);
      expect(result?.output).toBe("# notes\nthe plan\nran\n755\n644\n");
    }).pipe(Effect.provide(testWorld)),
  );

  it.live(
    "after the workspace restarts the context is expanded again from the stored archive",
    () =>
      Effect.gen(function* () {
        const context = yield* Effect.promise(files);

        const script = [
          bash("echo edited > /context/notes.md; cat /context/notes.md"),
          say("edited"),
          bash("cat /context/notes.md"),
          say("read again"),
        ];

        let calls = 0;

        const { sessionId, world } = yield* startSession(
          () => {
            calls += 1;

            return script[calls - 1] ?? say("done");
          },
          { context },
        );

        yield* finished(sessionId);
        world.records(sessionId).workspace.restart();

        const handle = yield* world.handle(sessionId);

        yield* handle.prompt({ text: "again", mode: "followUp" });
        yield* finished(sessionId, 4);

        const results = yield* resultsOf(sessionId);

        expect(results.map((result) => result.output)).toEqual(["edited\n", "# notes\n"]);
      }).pipe(Effect.provide(testWorld)),
  );
});
