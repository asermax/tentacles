import type { PreviewToken } from "@tentacles/contracts/preview-router";
import { RegistryStore } from "@tentacles/contracts/registry-store";
import { SessionHost } from "@tentacles/contracts/session-host";
import * as Effect from "effect/Effect";

const notFound = () => new Response("No preview here", { status: 404 });

/** The preview route's handler: the app's response for a known token, 404 otherwise. */
export const previewHandler = (token: PreviewToken, request: Request) =>
  Effect.gen(function* () {
    const target = yield* (yield* RegistryStore).resolvePreview(token);

    if (target == null) {
      return notFound();
    }

    return yield* (yield* SessionHost)
      .preview(target.sessionId, target.port, request)
      .pipe(Effect.catchTag("SessionNotFound", () => Effect.sync(notFound)));
  });
