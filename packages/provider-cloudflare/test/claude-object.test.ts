import { describe, expect, it } from "@effect/vitest";
import { beforeEach } from "vitest";

import {
  alarmAfterIdle,
  callClaude,
  claudeObject,
  forwardedCallId,
  reportCallEnd,
  resetClaude,
  restartClaude,
} from "./claude";

const sleepAfterMs = 15 * 60_000;

const sigterm = 15;

const pastSleepAfterMs = 20 * 60_000;

const anthropicInterception = { protocol: "https", host: "api.anthropic.com" };

const internalInterception = { protocol: "http", host: "tentacles.internal" };

// An object armed by an instance that found the container running, as after a restart.
const armedClaude = async (setup: Parameters<typeof resetClaude>[0] = {}) => {
  await resetClaude({ isRunning: true, ...setup });
  await restartClaude();
};

// What arming a running container sets: the platform's timeout, both interceptions, a monitor and the alarm.
const expectArmed = async () => {
  const { inactivityTimeoutMs, interceptions, openMonitorCount } =
    await claudeObject().containerState();

  expect(inactivityTimeoutMs).toBe(sleepAfterMs);
  expect(interceptions).toEqual(
    expect.arrayContaining([anthropicInterception, internalInterception]),
  );
  expect(openMonitorCount).toBeGreaterThan(0);
  expect(await claudeObject().alarmAt()).not.toBeNull();
};

beforeEach(async () => {
  await resetClaude();
});

describe("the Claude object's calls", () => {
  it("waits for the relay's start before it forwards the first call", async () => {
    await resetClaude({ readyOnProbe: 3 });

    const response = await callClaude();
    const { starts, relayRequests } = await claudeObject().containerState();

    expect(response.status).toBe(200);
    expect(starts).toHaveLength(1);
    expect(relayRequests.map((request) => request.probesAnswered)).toEqual([3]);
  });

  it("starts the container once and forwards and counts both of two calls that arrive during the start", async () => {
    await resetClaude({ readyOnProbe: 3, answers: ["open"] });

    const responses = await Promise.all([callClaude(), callClaude()]);
    const { starts, relayRequests } = await claudeObject().containerState();
    const firstCallId = await forwardedCallId(0);
    const secondCallId = await forwardedCallId(1);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(starts).toHaveLength(1);
    expect(relayRequests.map((request) => request.probesAnswered)).toEqual([3, 3]);
    expect(firstCallId).not.toBe(secondCallId);

    await reportCallEnd(firstCallId);

    expect(await alarmAfterIdle(pastSleepAfterMs)).toEqual([]);

    await reportCallEnd(secondCallId);

    expect(await alarmAfterIdle(sleepAfterMs)).toEqual([sigterm]);
  });

  it("forwards a call to a running container with its call id and counts it", async () => {
    await resetClaude({ isRunning: true, answers: ["open"] });

    const response = await callClaude();
    const { starts, relayRequests } = await claudeObject().containerState();

    expect(response.status).toBe(200);
    expect(starts).toHaveLength(0);
    expect(relayRequests).toHaveLength(1);
    expect(await forwardedCallId(0)).toEqual(expect.any(String));
    expect(await alarmAfterIdle(pastSleepAfterMs)).toEqual([]);
  });

  it("takes a call off the count when it cannot reach the relay", async () => {
    await resetClaude({ isRunning: true, answers: ["unreachable"] });

    const response = await callClaude().catch(() => null);

    expect(response?.status).not.toBe(200);
    expect(await alarmAfterIdle(sleepAfterMs)).toEqual([sigterm]);
  });

  it("arms the container it starts and counts the call that started it", async () => {
    await resetClaude({ answers: ["open"] });

    const response = await callClaude();
    const { starts } = await claudeObject().containerState();

    expect(response.status).toBe(200);
    expect(starts).toHaveLength(1);

    await expectArmed();

    expect(await alarmAfterIdle(pastSleepAfterMs)).toEqual([]);
  });

  it("holds a call that arrives while the object is stopping until the container is gone, then starts a new one", async () => {
    await armedClaude();

    expect(await alarmAfterIdle(sleepAfterMs)).toEqual([sigterm]);

    const heldCallResponse = callClaude();

    await scheduler.wait(200);

    const containerWhileHeld = await claudeObject().containerState();

    expect(containerWhileHeld.relayRequests).toHaveLength(0);
    expect(containerWhileHeld.starts).toHaveLength(0);

    await claudeObject().stopContainer();

    const response = await heldCallResponse;
    const { starts, relayRequests } = await claudeObject().containerState();

    expect(response.status).toBe(200);
    expect(starts).toHaveLength(1);
    expect(relayRequests).toHaveLength(1);

    // The held call is counted again, and the container it started can be stopped when it is idle.
    expect(await alarmAfterIdle(pastSleepAfterMs)).toEqual([sigterm]);

    await reportCallEnd(await forwardedCallId(0));

    expect(await alarmAfterIdle(sleepAfterMs)).toEqual([sigterm, sigterm]);
  });
});

describe("the Claude object's alarm", () => {
  it("stops a container that has been idle for 15 minutes with SIGTERM", async () => {
    await armedClaude();

    expect(await alarmAfterIdle(sleepAfterMs)).toEqual([sigterm]);
    expect(await claudeObject().alarmAt()).not.toBeNull();
  });

  it("leaves a container that has been idle for less than 15 minutes running", async () => {
    await armedClaude();

    expect(await alarmAfterIdle(sleepAfterMs - 60_000)).toEqual([]);
    expect(await claudeObject().alarmAt()).not.toBeNull();
  });

  it("leaves a container with a call in flight running past 15 minutes", async () => {
    await armedClaude({ answers: ["open"] });
    await callClaude();

    expect(await alarmAfterIdle(pastSleepAfterMs)).toEqual([]);
  });

  it("does not stop a container twice", async () => {
    await armedClaude();

    expect(await alarmAfterIdle(sleepAfterMs)).toEqual([sigterm]);
    expect(await alarmAfterIdle(sleepAfterMs)).toEqual([sigterm]);
  });

  it("neither signals nor sets another alarm once the container has stopped running", async () => {
    await armedClaude();
    await claudeObject().vanishContainer();

    expect(await alarmAfterIdle(sleepAfterMs)).toEqual([]);
    expect(await claudeObject().alarmAt()).toBeNull();
  });
});

describe("a new Claude object instance", () => {
  it("arms a container it finds running and keeps its calls, so the next alarm pass does not stop it", async () => {
    await resetClaude({ isRunning: true });

    const callId = crypto.randomUUID();

    await claudeObject().storeCall(callId);
    await restartClaude();

    await expectArmed();

    expect(await claudeObject().storedCallIds()).toEqual([callId]);
    expect(await alarmAfterIdle(pastSleepAfterMs)).toEqual([]);
  });

  it("arms nothing when it finds the container stopped", async () => {
    await resetClaude({ isRunning: false });
    await restartClaude();

    const { inactivityTimeoutMs, interceptions, openMonitorCount } =
      await claudeObject().containerState();

    expect(inactivityTimeoutMs).toBeNull();
    expect(interceptions).toEqual([]);
    expect(openMonitorCount).toBe(0);
    expect(await claudeObject().alarmAt()).toBeNull();
  });
});

describe("a Claude container that stops", () => {
  it("forgets the calls in flight, so the next container is not kept up by them", async () => {
    await armedClaude({ answers: ["open", "done"] });
    await callClaude();
    await claudeObject().stopContainer();

    const response = await callClaude();
    const { starts } = await claudeObject().containerState();

    expect(response.status).toBe(200);
    expect(starts).toHaveLength(1);

    await reportCallEnd(await forwardedCallId(1));

    expect(await alarmAfterIdle(sleepAfterMs)).toEqual([sigterm]);
  });

  it("starts a new container for the next call once the idle stop has completed", async () => {
    await armedClaude();

    expect(await alarmAfterIdle(sleepAfterMs)).toEqual([sigterm]);

    await claudeObject().stopContainer();

    const response = await callClaude();
    const { starts, relayRequests } = await claudeObject().containerState();

    expect(response.status).toBe(200);
    expect(starts).toHaveLength(1);
    expect(relayRequests).toHaveLength(1);
  });
});
