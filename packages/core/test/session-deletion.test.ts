import { fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "@effect/vitest";
import { RegistryStore } from "@tentacles/contracts/registry-store";
import { InvalidWorkspace, SessionNotFound } from "@tentacles/worker-api/errors";
import { SessionId } from "@tentacles/worker-api/ids";
import { SessionListing } from "@tentacles/worker-api/session-state";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { post, serveApi } from "./support/api";
import { eventually } from "./support/eventually";
import { createRequest, parent } from "./support/fixtures";
import { heldAnswer } from "./support/model";
import { newSessionId, TestWorld, testWorld } from "./support/world";

const decodeCreated = Schema.decodeUnknownSync(Schema.Struct({ sessionId: SessionId }));

const decodeNotFound = Schema.decodeUnknownSync(SessionNotFound);

const decodeListings = Schema.decodeUnknownSync(Schema.Array(SessionListing));

const json = (response: Response) => Effect.promise(() => response.json());

type Api = Effect.Success<typeof serveApi>;

const createOver = (api: Api) =>
  Effect.gen(function* () {
    const response = yield* api("/sessions", post(JSON.stringify(createRequest("go"))));

    return decodeCreated(yield* json(response)).sessionId;
  });

const listedSessionIds = (api: Api) =>
  Effect.gen(function* () {
    const response = yield* api(`/sessions?harness=pi&sessionId=${parent.sessionId}`);

    return decodeListings(yield* json(response)).map((listing) => listing.sessionId);
  });

const remove = (api: Api, sessionId: SessionId) =>
  api(`/sessions/${sessionId}`, { method: "DELETE" });

const expectEveryCallNotFound = (api: Api, sessionId: SessionId) =>
  Effect.gen(function* () {
    const calls = [
      api(`/sessions/${sessionId}/prompt`, post(JSON.stringify({ text: "hi", mode: "followUp" }))),
      api(`/sessions/${sessionId}/answer`, post(JSON.stringify({ questionId: "1", text: "yes" }))),
      api(`/sessions/${sessionId}/close`, { method: "POST" }),
      api(`/sessions/${sessionId}/messages`),
      api(`/sessions/${sessionId}/status`),
      remove(api, sessionId),
    ];

    for (const call of calls) {
      const response = yield* call;

      expect(response.status).toBe(404);
      expect(decodeNotFound(yield* json(response))).toEqual(new SessionNotFound({ sessionId }));
    }
  });

describe("deleting a session through the API", () => {
  it.live("answers 204 for an idle session, and the list and every call no longer know it", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const api = yield* serveApi;

      world.faux.setResponses([fauxAssistantMessage("done")]);

      const sessionId = yield* createOver(api);

      yield* eventually(Effect.sync(() => expect(world.records(sessionId).states).toHaveLength(2)));

      const response = yield* remove(api, sessionId);

      expect(response.status).toBe(204);
      expect(yield* listedSessionIds(api)).toEqual([]);
      yield* expectEveryCallNotFound(api, sessionId);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("deletes a setup-failed entry, which has no record", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const api = yield* serveApi;

      world.failures.workspaceCreate = new InvalidWorkspace({ message: "No such repository" });

      yield* api("/sessions", post(JSON.stringify(createRequest("go"))));

      const [sessionId] = yield* listedSessionIds(api);

      const response = yield* remove(api, yield* Effect.fromNullishOr(sessionId));

      expect(response.status).toBe(204);
      expect(yield* listedSessionIds(api)).toEqual([]);
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("answers SessionNotFound for an id the registry does not know", () =>
    Effect.gen(function* () {
      const api = yield* serveApi;
      const sessionId = newSessionId();
      const response = yield* remove(api, sessionId);

      expect(response.status).toBe(404);
      expect(decodeNotFound(yield* json(response))).toEqual(new SessionNotFound({ sessionId }));
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("deletes a session while its run goes on", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const api = yield* serveApi;
      const held = heldAnswer("still going");

      world.faux.setResponses([held.response]);

      const sessionId = yield* createOver(api);

      const response = yield* remove(api, sessionId);

      expect(response.status).toBe(204);
      expect(yield* listedSessionIds(api)).toEqual([]);
      yield* expectEveryCallNotFound(api, sessionId);
      held.release();
    }).pipe(Effect.provide(testWorld)),
  );

  it.live("answers 500 and keeps the entry when the deletion fails, and a retry deletes it", () =>
    Effect.gen(function* () {
      const world = yield* TestWorld;
      const api = yield* serveApi;
      const registry = yield* RegistryStore;

      world.faux.setResponses([fauxAssistantMessage("done")]);

      const sessionId = yield* createOver(api);

      yield* eventually(Effect.sync(() => expect(world.records(sessionId).states).toHaveLength(2)));

      world.failures.deleteOnce.add(sessionId);

      expect((yield* remove(api, sessionId)).status).toBe(500);
      expect(yield* listedSessionIds(api)).toEqual([sessionId]);
      expect(yield* registry.has(sessionId)).toBe(true);

      expect((yield* remove(api, sessionId)).status).toBe(204);
      expect(yield* listedSessionIds(api)).toEqual([]);
      yield* expectEveryCallNotFound(api, sessionId);
    }).pipe(Effect.provide(testWorld)),
  );
});
