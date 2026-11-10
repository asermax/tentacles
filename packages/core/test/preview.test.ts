import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "@effect/vitest";
import { PreviewToken } from "@tentacles/contracts/preview-router";
import { RegistryStore } from "@tentacles/contracts/registry-store";
import { SessionHost } from "@tentacles/contracts/session-host";
import { Entry } from "@tentacles/worker-api/entries";
import type { SessionId } from "@tentacles/worker-api/ids";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { previewHandler } from "../src/index.ts";
import { eventually } from "./support/eventually.ts";
import { createRequest } from "./support/fixtures.ts";
import { heldAnswer } from "./support/model.ts";
import { newSessionId, TestWorld, testWorld } from "./support/world.ts";

const preview = (args: { action: "open"; port: number } | { action: "close" }) =>
  fauxAssistantMessage(fauxToolCall("preview", args), { stopReason: "toolUse" });

const decodeOpened = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Struct({ action: Schema.Literal("open"), url: Schema.String, cdpUrl: Schema.String }),
  ),
);

const decodeToken = Schema.decodeUnknownSync(PreviewToken);

/** The token a preview URL carries, as the test's PreviewRouter builds it. */
const tokenOf = (url: string) => decodeToken(new URL(url).hostname.split(".")[0]);

/** Starts a session that runs the given tool calls and then waits until released. */
const runTools = (calls: ReturnType<typeof preview>[]) =>
  Effect.gen(function* () {
    const world = yield* TestWorld;
    const sessionId = newSessionId();
    const held = heldAnswer("checked");

    world.faux.setResponses([...calls, held.response]);

    const handle = yield* world.handle(sessionId);

    yield* handle.create(createRequest("check the app"));
    yield* eventually(Effect.sync(() => expect(world.faux.state.callCount).toBe(calls.length + 1)));

    const results = (yield* handle.messages(50)).filter(Entry.guards.toolResult);

    return { sessionId, results, records: world.records(sessionId), release: held.release };
  });

const resolve = (token: PreviewToken) =>
  Effect.flatMap(RegistryStore, (registry) => registry.resolvePreview(token));

describe("the preview tool", () => {
  it.live("opens a preview and returns its URL and the browser's CDP URL", () =>
    Effect.gen(function* () {
      const { sessionId, results, records, release } = yield* runTools([
        preview({ action: "open", port: 3000 }),
      ]);

      const opened = decodeOpened(results[0]?.output);

      expect(opened.cdpUrl).toBe("wss://browser.test/2");
      expect(opened.url).toMatch(/^https:\/\/[0-9a-f-]+\.preview\.test\/$/);
      expect(yield* resolve(tokenOf(opened.url))).toEqual({ sessionId, port: 3000 });
      expect(records.browser).toEqual(["close", "open"]);
      release();
    }).pipe(Effect.provide(testWorld)),
  );

  it.live(
    "opening over an open preview closes the old browser first and retires the old token",
    () =>
      Effect.gen(function* () {
        const { sessionId, results, records, release } = yield* runTools([
          preview({ action: "open", port: 3000 }),
          preview({ action: "open", port: 4000 }),
        ]);

        const first = decodeOpened(results[0]?.output);
        const second = decodeOpened(results[1]?.output);

        expect(records.browser).toEqual(["close", "open", "close", "open"]);
        expect(yield* resolve(tokenOf(first.url))).toBeNull();
        expect(yield* resolve(tokenOf(second.url))).toEqual({ sessionId, port: 4000 });
        release();
      }).pipe(Effect.provide(testWorld)),
  );

  it.live("a browser that fails to open fails the tool and records nothing", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.failures.browserOpen = true;

      const { sessionId, results, release } = yield* runTools([
        preview({ action: "open", port: 3000 }),
      ]);

      expect(results[0]?.isError).toBe(true);
      expect(world.registryCalls).not.toContain(`openPreview ${sessionId}`);
      release();
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("a store that fails closes the browser it opened and fails the tool", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;

      world.failures.openPreview = true;

      const { results, records, release } = yield* runTools([
        preview({ action: "open", port: 3000 }),
      ]);

      expect(results[0]?.isError).toBe(true);
      expect(records.browser).toEqual(["close", "open", "close"]);
      release();
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("closing the preview closes its browser and retires its token", () =>
    Effect.gen(function* () {
      const { results, records, release } = yield* runTools([
        preview({ action: "open", port: 3000 }),
        preview({ action: "close" }),
      ]);

      const opened = decodeOpened(results[0]?.output);

      expect(results[1]?.output).toBe(JSON.stringify({ action: "close" }));
      expect(records.browser).toEqual(["close", "open", "close"]);
      expect(yield* resolve(tokenOf(opened.url))).toBeNull();
      release();
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("closing with no preview open is not an error", () =>
    Effect.gen(function* () {
      const { results, release } = yield* runTools([preview({ action: "close" })]);

      expect(results[0]).toMatchObject({
        output: JSON.stringify({ action: "close" }),
        isError: false,
      });
      release();
    }).pipe(Effect.provide(testWorld)),
  );
});

const openPreviewFor = (sessionId: SessionId, port: number) =>
  Effect.flatMap(RegistryStore, (registry) => registry.openPreview(sessionId, port));

const unknownToken = decodeToken("9b2f6c1e-3d4a-4f5b-8c7d-0e1f2a3b4c5d");

const request = () => new Request("https://token.preview.test/index.html");

const createdSession = Effect.gen(function* () {
  const world = yield* TestWorld;
  const sessionId = newSessionId();
  const held = heldAnswer("done");

  world.faux.setResponses([held.response]);
  yield* (yield* world.handle(sessionId)).create(createRequest("serve"));

  return { sessionId, release: held.release };
});

describe("the preview handler", () => {
  it.live("forwards a known token's request to the session's workspace port", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const { sessionId, release } = yield* createdSession;
      const forwarded: Array<{ port: number; url: string }> = [];

      world.records(sessionId).workspace.forward = (port, forwardedRequest) => {
        forwarded.push({ port, url: forwardedRequest.url });

        return new Response("the app", { status: 200 });
      };

      const { token } = yield* openPreviewFor(sessionId, 3000);
      const response = yield* previewHandler(token, request());

      expect(response.status).toBe(200);
      expect(yield* Effect.promise(() => response.text())).toBe("the app");
      expect(forwarded).toEqual([{ port: 3000, url: request().url }]);
      release();
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("answers 404 for an unknown token and for one a stop cleared", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const { sessionId, release } = yield* createdSession;
      const { token } = yield* openPreviewFor(sessionId, 3000);

      expect((yield* previewHandler(unknownToken, request())).status).toBe(404);

      release();
      yield* eventually(Effect.sync(() => expect(world.records(sessionId).states).toHaveLength(2)));

      expect((yield* previewHandler(token, request())).status).toBe(404);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("answers 404 for the token of a deleted session", () =>
    Effect.gen(function* () {
      const { sessionId, release } = yield* createdSession;
      const { token } = yield* openPreviewFor(sessionId, 3000);

      release();
      yield* (yield* SessionHost).delete(sessionId);

      expect((yield* previewHandler(token, request())).status).toBe(404);
    }).pipe(Effect.provide(testWorld)),
  );
});
