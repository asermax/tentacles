import { describe, expect, it } from "vitest";

import { ToolTable } from "../src/core/tool-table";

const uuid = expect.objectContaining({ type: "string", format: "uuid" });

describe("tool table arguments", () => {
  it("gives prompt its path params with its payload", () => {
    expect(ToolTable.prompt.arguments).toMatchObject({
      type: "object",
      properties: {
        sessionId: uuid,
        text: { type: "string" },
        mode: {
          anyOf: [
            expect.objectContaining({ type: "string", enum: ["followUp"] }),
            expect.objectContaining({ type: "string", enum: ["steer"] }),
          ],
        },
      },
      required: ["sessionId", "text", "mode"],
    });
  });

  it("gives answer its path params with its payload", () => {
    expect(ToolTable.answer.arguments).toMatchObject({
      properties: { sessionId: uuid, questionId: { type: "string" }, text: { type: "string" } },
      required: ["sessionId", "questionId", "text"],
    });
  });

  it("gives close its path params alone", () => {
    expect(ToolTable.close.arguments).toMatchObject({
      properties: { sessionId: uuid },
      required: ["sessionId"],
    });
  });

  it("gives messages its path params with its query, the count an optional integer", () => {
    expect(ToolTable.messages.arguments).toMatchObject({
      properties: {
        sessionId: uuid,
        count: expect.objectContaining({ type: "integer", minimum: 1 }),
      },
      required: ["sessionId"],
    });
  });

  it("leaves parent out of spawn, makes every setting optional and lists skills and agents as optional string arrays", () => {
    const spawn = ToolTable.spawn.arguments;

    expect(
      Object.keys(spawn.properties ?? {}).toSorted((left, right) => left.localeCompare(right)),
    ).toEqual(["agents", "name", "prompt", "settings", "skills"]);
    expect(spawn.required).toEqual(["name", "prompt"]);
    expect(spawn).toHaveProperty("properties.skills", {
      type: "array",
      items: { type: "string" },
      description: expect.any(String),
    });
    expect(spawn).toHaveProperty("properties.agents", {
      type: "array",
      items: { type: "string" },
      description: expect.any(String),
    });
    expect(spawn).toHaveProperty("properties.settings", {
      type: "object",
      additionalProperties: true,
      properties: {
        provider: { type: "string" },
        model: { type: "string" },
        effort: { type: "string" },
        image: { type: "string" },
        size: { type: "string" },
        lifetime: expect.objectContaining({ type: "integer" }),
        repository: {
          anyOf: [
            expect.objectContaining({
              type: "object",
              properties: { url: { type: "string" }, shallow: { type: "boolean" } },
              required: expect.arrayContaining(["url"]),
            }),
            { type: "null" },
          ],
        },
      },
    });
  });

  it("gives list no arguments", () => {
    expect(ToolTable.list.arguments).toEqual({ type: "object", properties: {} });
  });
});
