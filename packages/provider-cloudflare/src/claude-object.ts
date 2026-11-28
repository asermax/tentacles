import * as Cloudflare from "@alchemy.run/cloudflare";
import { callIdHeader, newCallId, type CallId } from "@tentacles/relay-protocol/call-id";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Schedule from "effect/Schedule";
import * as Semaphore from "effect/Semaphore";

import { createClaudeCalls } from "./claude-calls";
import { credentialPlaceholder, egressCaPath, interceptEgressHosts, loopback } from "./egress";

const relayPort = 8080;

// The container sleeps once no call has reached it for this long.
const sleepAfter = 15 * 60_000;

// An alarm pass waits this long before it sets the next alarm, so the object always has work in
// progress while the container runs.
export const keepAliveWait = 50_000;

const alarmDelay = 1_000;

const sigterm = 15;

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
 * The shared Claude object: starts the Claude container on the first call after it slept, keeps itself and
 * the container up while the container is in use, stops it after 15 idle minutes, and passes each relay
 * request to it. The container calls api.anthropic.com through the egress and reports each call's end to the
 * Worker, which tells this object.
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
        const claudeCalls = createClaudeCalls(state.raw.storage, sleepAfter);

        // Concurrent first calls share one start.
        const starting = yield* Semaphore.make(1);

        // Settled once the container the object holds is gone and its calls are forgotten.
        let containerStopped = Deferred.makeUnsafe<void>();

        // Keeps the container and the object up while the container runs: the platform's timeout, both
        // interceptions (which a new container lacks), the monitor and the alarm loop that hold the object in use.
        const armContainer = Effect.gen(function* () {
          yield* Effect.promise(() =>
            Promise.all([
              container.setInactivityTimeout(sleepAfter),
              interceptEgressHosts(container, egress),
            ]),
          );

          // monitor() settles when the container stops, whoever stopped it, and rejects when it fails.
          const thisContainerStopped = Deferred.makeUnsafe<void>();

          containerStopped = thisContainerStopped;

          yield* state.waitUntil(
            Effect.promise(() => container.monitor().catch(() => {})).pipe(
              Effect.andThen(Effect.sync(() => claudeCalls.reset())),
              Effect.andThen(Deferred.succeed(thisContainerStopped, undefined)),
            ),
          );

          claudeCalls.recordFirstActivity(Date.now());

          yield* Effect.promise(async () => {
            if ((await state.raw.storage.getAlarm()) == null) {
              await state.raw.storage.setAlarm(Date.now() + alarmDelay);
            }
          });
        });

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

          yield* armContainer;
          yield* relayReady(container);
        });

        // A container that is not running has no calls, whatever an earlier instance stored.
        if (container.running) {
          yield* armContainer;
        } else {
          claudeCalls.reset();
        }

        return {
          callEnded: (callId: CallId) => Effect.sync(() => claudeCalls.remove(callId)),

          // The object stops the container itself once no call is in flight and the idle time has
          // passed. The check and the mark happen in one step, so a call counted meanwhile either sees
          // the stopping mark or was counted before the check.
          alarm: () =>
            Effect.gen(function* () {
              if (container.running && claudeCalls.stopIfIdle(Date.now())) {
                container.signal(sigterm);
              }

              yield* Effect.sleep(keepAliveWait);

              if (container.running) {
                yield* Effect.promise(() => state.raw.storage.setAlarm(Date.now() + alarmDelay));
              }
            }),

          fetch: Effect.gen(function* () {
            // Counted before anything is awaited, so no alarm pass sees an empty count while the call
            // is on its way.
            const callId = newCallId();

            claudeCalls.add(callId);

            const request = yield* HttpServerRequest.HttpServerRequest.pipe(
              Effect.flatMap(HttpServerRequest.toWeb),
              Effect.orDie,
            );

            // A call that finds the object stopping waits for the container to be gone, and is counted
            // again since the container's stop forgot it.
            if (claudeCalls.isStopping()) {
              yield* Effect.suspend(() =>
                container.running
                  ? Deferred.await(containerStopped)
                  : Effect.sync(() => claudeCalls.reset()),
              );

              claudeCalls.add(callId);
            }

            // The relay reports a call's end only once it has the call, so a call that never reaches it
            // is taken off the count here.
            return yield* Effect.gen(function* () {
              yield* starting.withPermit(
                Effect.suspend(() => (container.running ? Effect.void : start)),
              );

              const relayRequest = new Request(request);

              relayRequest.headers.set(callIdHeader, callId);

              const relayResponse = yield* Effect.promise(() =>
                container.getTcpPort(relayPort).fetch(relayRequest),
              );

              return HttpServerResponse.raw(relayResponse, { status: relayResponse.status });
            }).pipe(Effect.onError(() => Effect.sync(() => claudeCalls.remove(callId))));
          }),
        };
      }),
  ),
) {}
