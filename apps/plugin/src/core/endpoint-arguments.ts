import { TentaclesApi } from "@tentacles/worker-api/api";
import type { SessionsGroup } from "@tentacles/worker-api/sessions";
import type * as JsonSchema from "effect/JsonSchema";
import * as Schema from "effect/Schema";
import { HttpApi } from "effect/http-api";

// The properties come from the decoded side, so a query's count is an integer
// rather than its URL string, and the required keys from the wire side, so a
// field with a decoding default stays optional for the agent.
const argumentsOf = (part: Schema.Top) => {
  const decodedDocument = Schema.toJsonSchemaDocument(Schema.toType(part));
  const wire = Schema.toJsonSchemaDocument(part);

  return {
    properties: decodedDocument.schema.properties ?? {},
    required: wire.schema.required ?? [],
    definitions: { ...decodedDocument.definitions, ...wire.definitions },
  };
};

/** One endpoint tool's arguments: its path params with its payload or query, as one JSON Schema object. */
export const endpointArguments = (
  name: keyof typeof SessionsGroup.endpoints,
): JsonSchema.JsonSchema => {
  const parts: Array<Schema.Top> = [];

  HttpApi.reflect(TentaclesApi, {
    predicate: ({ endpoint }) => endpoint.identifier === name,
    onGroup: () => undefined,
    onEndpoint: ({ endpoint }) => {
      const payloads = [...endpoint.payload.values()].flatMap((payload) => payload.schemas);

      parts.push(...[endpoint.params, endpoint.query, payloads[0]].filter((part) => part != null));
    },
  });

  const partArguments = parts.map(argumentsOf);

  return {
    type: "object",
    properties: Object.assign({}, ...partArguments.map((part) => part.properties)),
    required: partArguments.flatMap((part) => part.required),
    $defs: Object.assign({}, ...partArguments.map((part) => part.definitions)),
  };
};
