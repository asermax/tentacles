import { HttpApiMiddleware, HttpApiSecurity } from "effect/http-api";

import { Unauthorized } from "./errors";

/** Every request carries the API key as a bearer token; a provider checks it against its secret. */
export class ApiKey extends HttpApiMiddleware.Service<ApiKey>()("tentacles/ApiKey", {
  security: {
    bearer: HttpApiSecurity.bearer,
  },
  error: Unauthorized,
}) {}
