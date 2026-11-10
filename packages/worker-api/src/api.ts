import { HttpApi } from "effect/http-api";

import { SessionsGroup } from "./sessions.ts";

export class TentaclesApi extends HttpApi.make("tentacles").add(SessionsGroup).prefix("/api") {}
