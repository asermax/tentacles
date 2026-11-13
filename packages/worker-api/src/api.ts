import { HttpApi } from "effect/http-api";

import { SessionsGroup } from "./sessions";

export class TentaclesApi extends HttpApi.make("tentacles").add(SessionsGroup).prefix("/api") {}
