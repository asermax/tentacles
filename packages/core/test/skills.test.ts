import type { AssistantMessage } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "@effect/vitest";
import { Entry } from "@tentacles/worker-api/entries";
import type { SessionId } from "@tentacles/worker-api/ids";
import * as Effect from "effect/Effect";

import { definitionArchives, skillBlockOf } from "./support/archives.ts";
import { eventually } from "./support/eventually.ts";
import { type Archives, createRequest } from "./support/fixtures.ts";
import { type ModelRequest, routedModel } from "./support/model.ts";
import { newSessionId, TestWorld, testWorld } from "./support/world.ts";

const say = (text: string) => fauxAssistantMessage(text);

const toolUse = (name: string, args: Readonly<Record<string, string>>) =>
  fauxAssistantMessage(fauxToolCall(name, args), { stopReason: "toolUse" });

const implement = skillBlockOf("implement");

const review = skillBlockOf("review");

const isRoot = (request: ModelRequest) => request.tools.has("ask_parent");

const isGrandchild = (request: ModelRequest) => !request.tools.has("subagent");

const startSession = (
  answer: (request: ModelRequest) => AssistantMessage | Promise<AssistantMessage>,
  archives: Archives,
) =>
  Effect.gen(function* () {
    const world = yield* TestWorld;
    const sessionId = newSessionId();
    const handle = yield* world.handle(sessionId);

    world.faux.setResponses(routedModel(answer));
    yield* handle.create(createRequest("go", null, archives));

    return { sessionId, handle, world };
  });

const settled = (sessionId: SessionId, text: string) =>
  eventually(
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const entries = yield* (yield* world.handle(sessionId)).messages(100);

      expect(entries).toContainEqual(Entry.cases.text.make({ text }));
    }),
  );

const toolResultsOf = (sessionId: SessionId) =>
  Effect.gen(function* () {
    const world = yield* TestWorld;

    return (yield* (yield* world.handle(sessionId)).messages(100)).filter(Entry.guards.toolResult);
  });

const promptWith = (text: string, archives: Archives) =>
  Effect.gen(function* () {
    const { sessionId, handle, world } = yield* startSession(() => say("ok"), archives);

    yield* eventually(Effect.sync(() => expect(world.records(sessionId).states).toHaveLength(2)));
    yield* handle.prompt({ text, mode: "followUp" });
    yield* eventually(Effect.sync(() => expect(world.records(sessionId).states).toHaveLength(4)));

    return (yield* handle.messages(10)).filter(Entry.guards.prompt).map((entry) => entry.text);
  });

describe("prompt expansion", () => {
  it.live("a /skill: trigger becomes the skill's block with the rest of the text around it", () =>
    Effect.gen(function* () {
      const archives = yield* definitionArchives();

      expect((yield* promptWith("use /skill:implement on the api", archives)).at(-1)).toBe(
        `use ${implement} on the api`,
      );
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a bare /name trigger at the start becomes the skill's block", () =>
    Effect.gen(function* () {
      const archives = yield* definitionArchives();

      expect((yield* promptWith("/review this", archives)).at(-1)).toBe(`${review} this`);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a path and a name that is not a held skill stay as written", () =>
    Effect.gen(function* () {
      const archives = yield* definitionArchives();
      const text = "see /tmp/notes and /deploy";

      expect((yield* promptWith(text, archives)).at(-1)).toBe(text);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a trigger inside a path or with punctuation attached stays as written", () =>
    Effect.gen(function* () {
      const archives = yield* definitionArchives();
      const text = "read /skills/implement/SKILL.md, then /implement. Also (/review) and x/review";

      expect((yield* promptWith(text, archives)).at(-1)).toBe(text);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a held name twice becomes two blocks, one at each trigger", () =>
    Effect.gen(function* () {
      const archives = yield* definitionArchives();

      expect((yield* promptWith("/implement then /implement again", archives)).at(-1)).toBe(
        `${implement} then ${implement} again`,
      );
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a session without skills sends a trigger as written", () =>
    Effect.gen(function* () {
      expect((yield* promptWith("/implement", {})).at(-1)).toBe("/implement");
    }).pipe(Effect.provide(testWorld)),
  );
});

describe("the skill tool and the skills section", () => {
  it.live("the root loads a held skill by name and gets its block", () =>
    Effect.gen(function* () {
      const { sessionId } = yield* startSession(
        (request) =>
          request.lastRole === "toolResult"
            ? say("Loaded.")
            : toolUse("skill", { name: "implement" }),
        yield* definitionArchives(),
      );

      yield* settled(sessionId, "Loaded.");
      const results = yield* toolResultsOf(sessionId);

      expect(results.map((result) => [result.output, result.isError])).toEqual([
        [implement, false],
      ]);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("loading a skill that is not held fails naming the held ones", () =>
    Effect.gen(function* () {
      const { sessionId } = yield* startSession(
        (request) =>
          request.lastRole === "toolResult" ? say("Failed.") : toolUse("skill", { name: "deploy" }),
        yield* definitionArchives(),
      );

      yield* settled(sessionId, "Failed.");

      const [result] = yield* toolResultsOf(sessionId);

      expect(result?.isError).toBe(true);
      expect(result?.output).toContain("deploy");
      expect(result?.output).toContain("implement");
      expect(result?.output).toContain("review");
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a grandchild loads a held skill by name", () =>
    Effect.gen(function* () {
      const grandchildSaw: string[] = [];

      const { sessionId } = yield* startSession(
        (request) => {
          if (isGrandchild(request)) {
            if (request.lastRole === "toolResult") {
              grandchildSaw.push(request.last);

              return say("loaded");
            }

            return toolUse("skill", { name: "review" });
          }

          if (request.lastRole === "toolResult") {
            return say(isRoot(request) ? "Done." : "child done");
          }

          return toolUse("subagent", {
            action: "run",
            task: isRoot(request) ? "start a subagent" : "load review",
          });
        },
        yield* definitionArchives(),
      );

      yield* settled(sessionId, "Done.");
      expect(grandchildSaw).toEqual([review]);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("the root's request lists each skill's name and description in the skills section", () =>
    Effect.gen(function* () {
      const sections: Array<string | undefined> = [];

      const { sessionId } = yield* startSession(
        (request) => {
          sections.push(request.sections.get("available_skills"));

          return say("Listed.");
        },
        yield* definitionArchives(),
      );

      yield* settled(sessionId, "Listed.");

      const [skills] = sections;

      expect(skills).toContain("<name>implement</name>");
      expect(skills).toContain("<description>Implement a change from its design</description>");
      expect(skills).toContain("<location>/skills/implement/SKILL.md</location>");
      expect(skills).toContain("<name>review</name>");
      expect(skills).toContain("<description>Review a change before it is merged</description>");
      expect(skills).toContain("<location>/skills/review/SKILL.md</location>");
    }).pipe(Effect.provide(testWorld)),
  );

  it.live(
    "a session without skills has no skills section and the skill tool fails naming none",
    () =>
      Effect.gen(function* () {
        const sections: Array<string | undefined> = [];

        const { sessionId } = yield* startSession((request) => {
          sections.push(request.sections.get("available_skills"));

          return request.lastRole === "toolResult"
            ? say("Failed.")
            : toolUse("skill", { name: "implement" });
        }, {});

        yield* settled(sessionId, "Failed.");

        const [result] = yield* toolResultsOf(sessionId);

        expect(sections.every((section) => section == null)).toBe(true);
        expect(result?.isError).toBe(true);
        expect(result?.output).toContain("No skill implement. Skills: none");
      }).pipe(Effect.provide(testWorld)),
  );
});
