import { Unauthorized } from "@tentacles/worker-api/errors";
import { ApiKey } from "@tentacles/worker-api/middleware";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

/** worker-api's ApiKey middleware, checking the bearer against the Worker secret. */
export const apiKeyLayer = (key: Redacted.Redacted) =>
  Layer.succeed(
    ApiKey,
    ApiKey.of({
      bearer: (httpEffect, { credential }) =>
        Redacted.value(credential) === Redacted.value(key)
          ? httpEffect
          : Effect.fail(new Unauthorized()),
    }),
  );
