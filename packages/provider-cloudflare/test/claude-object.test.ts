import { describe, expect, it } from "@effect/vitest";
import { beforeEach, vi } from "vitest";

import { callClaude, claudeObject, resetClaude, restartClaude } from "./claude";

const sleepAfterMs = 15 * 60_000;

const sigterm = 15;

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
    await resetClaude({ readyOnProbe: 3 });

    const responses = await Promise.all([callClaude(), callClaude()]);
    const { starts, relayRequests } = await claudeObject().containerState();
    const { callIds } = await claudeObject().storedCalls();

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(starts).toHaveLength(1);
    expect(relayRequests.map((request) => request.probesAnswered)).toEqual([3, 3]);

    const forwardedIds = relayRequests.map((request) => request.callId);

    expect(new Set(forwardedIds).size).toBe(2);
    expect(new Set(callIds)).toEqual(new Set(forwardedIds));
  });

  it("forwards a call to a running container with its call id and counts it", async () => {
    await resetClaude({ isRunning: true });

    const response = await callClaude();
    const { starts, relayRequests } = await claudeObject().containerState();
    const { callIds, lastActivity } = await claudeObject().storedCalls();

    expect(response.status).toBe(200);
    expect(starts).toHaveLength(0);
    expect(relayRequests).toHaveLength(1);
    expect(callIds).toEqual([relayRequests[0]?.callId]);
    expect(lastActivity).not.toBeNull();
  });

  it("takes a call off the count when it cannot reach the relay", async () => {
    await resetClaude({ isRunning: true, answers: ["unreachable"] });

    const response = await callClaude().catch(() => null);
    const { callIds } = await claudeObject().storedCalls();

    expect(response?.status).not.toBe(200);
    expect(callIds).toEqual([]);
  });

  it("arms the container it starts and counts the call that started it", async () => {
    const response = await callClaude();

    const { starts, relayRequests } = await claudeObject().containerState();
    const { callIds, lastActivity } = await claudeObject().storedCalls();

    expect(response.status).toBe(200);
    expect(starts).toHaveLength(1);

    await expectArmed();

    expect(callIds).toEqual([relayRequests[0]?.callId]);
    expect(lastActivity).not.toBeNull();
  });

  it("holds a call that arrives while the object is stopping until the container is gone, then starts a new one", async () => {
    await armedClaude();
    await claudeObject().storeStopping();

    const heldCallResponse = callClaude();

    await scheduler.wait(200);

    const containerWhileHeld = await claudeObject().containerState();

    expect(containerWhileHeld.relayRequests).toHaveLength(0);
    expect(containerWhileHeld.starts).toHaveLength(0);

    await claudeObject().stopContainer();

    const response = await heldCallResponse;
    const { starts, relayRequests } = await claudeObject().containerState();
    const { callIds, isStopping } = await claudeObject().storedCalls();

    expect(response.status).toBe(200);
    expect(starts).toHaveLength(1);
    expect(relayRequests).toHaveLength(1);
    expect(callIds).toEqual([relayRequests[0]?.callId]);
    expect(isStopping).toBe(false);
  });
});

describe("the Claude object's alarm", () => {
  it("stops a container that has been idle for 15 minutes with SIGTERM", async () => {
    await armedClaude();
    await claudeObject().storeLastActivity(sleepAfterMs);
    await claudeObject().runAlarm();

    const { signals } = await claudeObject().containerState();

    expect(signals).toEqual([sigterm]);
    expect((await claudeObject().storedCalls()).isStopping).toBe(true);
    expect(await claudeObject().alarmAt()).not.toBeNull();
  });

  it("leaves a container that has been idle for less than 15 minutes running", async () => {
    await armedClaude();
    await claudeObject().storeLastActivity(60_000);
    await claudeObject().runAlarm();

    expect((await claudeObject().containerState()).signals).toEqual([]);
    expect(await claudeObject().alarmAt()).not.toBeNull();
  });

  it("leaves a container with a call in flight running past 15 minutes", async () => {
    await armedClaude();
    await claudeObject().storeCall(crypto.randomUUID());
    await claudeObject().storeLastActivity(20 * 60_000);
    await claudeObject().runAlarm();

    expect((await claudeObject().containerState()).signals).toEqual([]);
  });

  it("does not stop a container twice", async () => {
    await armedClaude();
    await claudeObject().storeStopping();
    await claudeObject().storeLastActivity(sleepAfterMs);
    await claudeObject().runAlarm();

    expect((await claudeObject().containerState()).signals).toEqual([]);
  });

  it("neither signals nor sets another alarm once the container has stopped", async () => {
    await resetClaude({ isRunning: false });
    await claudeObject().storeLastActivity(sleepAfterMs);
    await claudeObject().runAlarm();

    expect((await claudeObject().containerState()).signals).toEqual([]);
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

    expect((await claudeObject().storedCalls()).callIds).toEqual([callId]);

    await claudeObject().storeLastActivity(20 * 60_000);
    await claudeObject().runAlarm();

    expect((await claudeObject().containerState()).signals).toEqual([]);
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
  it("clears the count, the stopping mark and the last activity when it dies with a call counted", async () => {
    await armedClaude();
    await claudeObject().storeCall(crypto.randomUUID());
    await claudeObject().storeStopping();
    await claudeObject().stopContainer();

    await vi.waitFor(async () =>
      expect(await claudeObject().storedCalls()).toEqual({
        callIds: [],
        isStopping: false,
        lastActivity: null,
      }),
    );
  });

  it("starts a new container for the next call once the idle stop has completed", async () => {
    await armedClaude();
    await claudeObject().storeLastActivity(sleepAfterMs);
    await claudeObject().runAlarm();
    await claudeObject().stopContainer();

    await vi.waitFor(async () =>
      expect((await claudeObject().storedCalls()).isStopping).toBe(false),
    );

    const response = await callClaude();
    const { starts, relayRequests } = await claudeObject().containerState();

    expect(response.status).toBe(200);
    expect(starts).toHaveLength(1);
    expect(relayRequests).toHaveLength(1);
  });
});
