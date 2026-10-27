import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequestThrottle } from "../src/utils/request-throttle.mjs";

test("keeps a minimum gap between the start of consecutive tasks", async () => {
  const throttle = createRequestThrottle({ minIntervalMs: 50, maxQueuedRequests: 10 });
  const startTimestamps = [];

  await Promise.all(
    [1, 2, 3].map(() =>
      throttle.schedule(async () => {
        startTimestamps.push(Date.now());
      })
    )
  );

  assert.equal(startTimestamps.length, 3);
  // A small tolerance absorbs timer imprecision.
  assert.ok(startTimestamps[1] - startTimestamps[0] >= 45);
  assert.ok(startTimestamps[2] - startTimestamps[1] >= 45);
});

test("rejects new tasks when the queue is full", async () => {
  const throttle = createRequestThrottle({ minIntervalMs: 20, maxQueuedRequests: 2 });
  const runningTasks = [throttle.schedule(async () => "first"), throttle.schedule(async () => "second")];

  await assert.rejects(throttle.schedule(async () => "third"), {
    statusCode: 503,
    reason: "MAP_SERVICE_BUSY",
  });

  assert.deepEqual(await Promise.all(runningTasks), ["first", "second"]);
});

test("a failed task does not block the tasks queued behind it", async () => {
  const throttle = createRequestThrottle({ minIntervalMs: 0, maxQueuedRequests: 5 });

  const failingTask = throttle.schedule(async () => {
    throw new Error("task failed");
  });
  const succeedingTask = throttle.schedule(async () => "ok");

  await assert.rejects(failingTask, /task failed/);
  assert.equal(await succeedingTask, "ok");
});
