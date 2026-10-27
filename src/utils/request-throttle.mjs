import { setTimeout as delay } from "node:timers/promises";
import { AppError } from "./app-error.mjs";

function createRequestThrottle({ minIntervalMs, maxQueuedRequests }) {
  let queueTail = Promise.resolve();
  let lastStartTimestamp = 0;
  let queuedRequestCount = 0;

  async function schedule(task) {
    if (queuedRequestCount >= maxQueuedRequests) {
      throw new AppError(
        "The map service is busy. Please try again in a moment.",
        503,
        "MAP_SERVICE_BUSY"
      );
    }

    queuedRequestCount += 1;

    const execution = queueTail.then(async () => {
      const remainingWaitMs = lastStartTimestamp + minIntervalMs - Date.now();

      if (remainingWaitMs > 0) await delay(remainingWaitMs);

      lastStartTimestamp = Date.now();

      return task();
    });

    queueTail = execution.catch(() => undefined);

    try {
      return await execution;
    } finally {
      queuedRequestCount -= 1;
    }
  }

  return { schedule };
}

export { createRequestThrottle };
