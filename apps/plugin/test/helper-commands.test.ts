import { QuestionNotWaiting, SessionNotFound, Unauthorized } from "@tentacles/worker-api/errors";
import { QuestionId } from "@tentacles/worker-api/ids";
import { afterEach, describe, expect, it } from "vitest";

import { Failure, Success } from "../src/core/helper-output.ts";
import { runHelperCommand, variablesFor } from "./helper-run.ts";
import { startStubWorker, type StubWorker } from "./stub-worker.ts";
import { helperErrorMessage, sessionIdOf, TextEntry } from "./values.ts";

const sessionId = sessionIdOf(1);

const missingId = sessionIdOf(99);

const parent = { harness: "pi", sessionId: "parent-session" };

const settingsVariables = {
  TENTACLES_SESSION_PROVIDER: "workers-ai",
  TENTACLES_SESSION_MODEL: "kimi-k3",
  TENTACLES_SESSION_EFFORT: "high",
  TENTACLES_WORKSPACE_IMAGE: "workspace:2",
  TENTACLES_WORKSPACE_SIZE: "standard-1",
  TENTACLES_WORKSPACE_LIFETIME: "30",
};

const scriptedSession = { states: [], entries: [] };

let worker: StubWorker | undefined;

const startWorker = async (...args: Parameters<typeof startStubWorker>) => {
  worker = await startStubWorker(...args);

  return worker;
};

afterEach(async () => {
  await worker?.stop();
  worker = undefined;
});

describe("helper commands against the Worker", () => {
  it("spawns with the default settings when no variable sets them, and answers with the new id", async () => {
    const stub = await startWorker({ createdId: sessionId });

    const result = await runHelperCommand(
      "spawn",
      { name: "migrate", prompt: "go", parent },
      variablesFor(stub.url),
    );

    expect(result).toEqual(Success.make({ result: { sessionId } }));
    expect(stub.requests).toEqual([
      {
        endpoint: "create",
        payload: {
          name: "migrate",
          prompt: "go",
          parent,
          settings: {
            provider: "placeholder-session-provider",
            model: "glm-5.2",
            effort: "max",
            image: "placeholder-workspace-image",
            size: "basic",
            lifetime: 15,
            repository: null,
          },
        },
      },
    ]);
  });

  it("spawns with the settings the variables set", async () => {
    const stub = await startWorker({ createdId: sessionId });

    await runHelperCommand(
      "spawn",
      { name: "migrate", prompt: "go", parent },
      variablesFor(stub.url, settingsVariables),
    );

    expect(stub.requests[0]?.payload).toMatchObject({
      settings: {
        provider: "workers-ai",
        model: "kimi-k3",
        effort: "high",
        image: "workspace:2",
        size: "standard-1",
        lifetime: 30,
        repository: null,
      },
    });
  });

  it("lets a setting the agent sends win over its variable and fills the rest from the variables", async () => {
    const stub = await startWorker({ createdId: sessionId });
    const repository = { url: "https://github.com/asermax/tentacles", shallow: true };

    await runHelperCommand(
      "spawn",
      {
        name: "migrate",
        prompt: "go",
        parent,
        settings: { model: "glm-5.2", lifetime: 5, repository },
      },
      variablesFor(stub.url, settingsVariables),
    );

    expect(stub.requests[0]?.payload).toMatchObject({
      settings: {
        provider: "workers-ai",
        model: "glm-5.2",
        effort: "high",
        image: "workspace:2",
        size: "standard-1",
        lifetime: 5,
        repository,
      },
    });
  });

  it("answers Failure SessionNotFound when the session does not exist", async () => {
    const stub = await startWorker();

    const result = await runHelperCommand(
      "prompt",
      { sessionId: missingId, text: "more", mode: "followUp" },
      variablesFor(stub.url),
    );

    expect(result).toEqual(Failure.make({ error: new SessionNotFound({ sessionId: missingId }) }));
  });

  it("answers Failure QuestionNotWaiting when the question no longer waits", async () => {
    const stub = await startWorker({
      sessions: new Map([[sessionId, scriptedSession]]),
      questionWaiting: false,
    });

    const result = await runHelperCommand(
      "answer",
      { sessionId, questionId: "q-1", text: "yes" },
      variablesFor(stub.url),
    );

    expect(result).toEqual(
      Failure.make({ error: new QuestionNotWaiting({ questionId: QuestionId.make("q-1") }) }),
    );
  });

  it("answers Failure Unauthorized when the Worker refuses the key", async () => {
    const stub = await startWorker();

    const result = await runHelperCommand(
      "list",
      { parent },
      variablesFor(stub.url, { TENTACLES_API_KEY: "wrong" }),
    );

    expect(result).toEqual(Failure.make({ error: new Unauthorized() }));
  });

  it("explains that the Worker did not answer at TENTACLES_URL when nothing listens there", async () => {
    const stub = await startWorker();

    await stub.stop();
    worker = undefined;

    const result = await runHelperCommand("list", { parent }, variablesFor(stub.url));

    expect(helperErrorMessage(result)).toContain(
      `The Worker did not answer at TENTACLES_URL (${stub.url})`,
    );
  });

  it("explains which status the Worker answered when it fails", async () => {
    const stub = await startWorker({ failing: true });

    const result = await runHelperCommand("list", { parent }, variablesFor(stub.url));

    expect(helperErrorMessage(result)).toBe(
      `The Worker at TENTACLES_URL (${stub.url}) answered with status 500.`,
    );
  });

  it("names the missing variable and sends no request when TENTACLES_URL is unset", async () => {
    const stub = await startWorker({ createdId: sessionId });
    const { TENTACLES_URL: _unset, ...variables } = variablesFor(stub.url);

    const result = await runHelperCommand(
      "spawn",
      { name: "migrate", prompt: "go", parent },
      variables,
    );

    expect(helperErrorMessage(result)).toContain("TENTACLES_URL");
    expect(stub.requests).toEqual([]);
  });

  it("asks for the last message only when messages gets no count", async () => {
    const last = TextEntry.make({ text: "last" });

    const stub = await startWorker({
      sessions: new Map([
        [sessionId, { states: [], entries: [TextEntry.make({ text: "first" }), last] }],
      ]),
    });

    const result = await runHelperCommand("messages", { sessionId }, variablesFor(stub.url));

    expect(stub.requests).toEqual([{ endpoint: "messages", sessionId, query: { count: 1 } }]);
    expect(result).toEqual(Success.make({ result: [last] }));
  });
});
