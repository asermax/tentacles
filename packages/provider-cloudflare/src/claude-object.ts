import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Schedule from "effect/Schedule";
import * as Semaphore from "effect/Semaphore";

import { credentialPlaceholder, EgressHosts, egressCaPath, loopback } from "./egress";

/** Every session reaches the same Claude container. */
export const claudeObjectName = "claude";

const relayPort = 8080;

// The container sleeps once no call has reached it for this long.
const sleepAfter = 15 * 60_000;

// The deploy publishes the class's image under the Container's id, and start names it.
const claudeContainerId = "ClaudeContainer";

/**
 * The Claude image. Its build context is apps/claude-relay after the relay's build, which leaves
 * the server as one file in dist/.
 */
export class ClaudeContainer extends Cloudflare.Container<ClaudeContainer>()(claudeContainerId, {
  schedulingPolicy: "durable_object",
  context: `${import.meta.dirname}/../../../apps/claude-relay`,
  dockerfile: `${import.meta.dirname}/../images/claude/Dockerfile`,
  build: {
    args: {
      EGRESS_CA_PATH: egressCaPath,
      CREDENTIAL_PLACEHOLDER: credentialPlaceholder,
    },
  },
}) {}

const relayReady = (container: Container) =>
  Effect.tryPromise(() => container.getTcpPort(relayPort).fetch("http://relay/")).pipe(
    Effect.filterOrFail((response) => response.ok),
    Effect.retry({ schedule: Schedule.spaced("1 second"), times: 30 }),
    Effect.orDie,
  );

/**
 * The shared Claude object: starts the Claude container on the first call after it slept and
 * passes each relay request to it. The container calls api.anthropic.com through the egress.
 */
export class ClaudeObject extends Cloudflare.DurableObject<ClaudeObject>()(
  "ClaudeObject",
  Effect.map(
    Effect.all({ state: Cloudflare.DurableObjectState, container: ClaudeContainer }),
    ({ state }) =>
      Effect.gen(function* () {
        const container = state.raw.container;

        if (container == null) {
          return yield* Effect.die(new Error("The Claude object has no container"));
        }

        const egress = yield* loopback(state);

        // Concurrent first calls share one start.
        const starting = yield* Semaphore.make(1);

        const start = Effect.gen(function* () {
          const image = yield* Effect.fromNullishOr(container.images[claudeContainerId]).pipe(
            Effect.mapError(() => new Error("The deploy published no Claude image")),
            Effect.orDie,
          );

          yield* Effect.sync(() =>
            container.start({
              image,
              instance: "standard-1",
              enableInternet: true,
              env: { PORT: String(relayPort) },
            }),
          );

          // The interceptor does not survive a restart, so it is set after every start.
          yield* Effect.promise(() =>
            Promise.all([
              container.setInactivityTimeout(sleepAfter),
              container.interceptOutboundHttps(EgressHosts.anthropic, egress),
            ]),
          );

          yield* relayReady(container);
        });

        return {
          fetch: Effect.gen(function* () {
            const request = yield* HttpServerRequest.HttpServerRequest.pipe(
              Effect.flatMap(HttpServerRequest.toWeb),
              Effect.orDie,
            );

            yield* starting.withPermit(
              Effect.suspend(() => (container.running ? Effect.void : start)),
            );

            const response = yield* Effect.promise(() =>
              container.getTcpPort(relayPort).fetch(request),
            );

            return HttpServerResponse.raw(response, { status: response.status });
          }),
        };
      }),
  ),
) {}
