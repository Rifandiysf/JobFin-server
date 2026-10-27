import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { createUserRateLimiter } from "../src/middlewares/rate-limit.middleware.mjs";

async function startServer(app) {
  const server = await new Promise((resolve) => {
    const startedServer = app.listen(0, () => resolve(startedServer));
  });

  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

test("limits requests per authenticated user and answers with the standard error format", async () => {
  const app = express();
  const limiter = createUserRateLimiter({ windowMs: 60_000, limit: 2, message: "Too many requests." });

  // Stands in for the real authentication middleware.
  app.use((req, res, next) => {
    req.user = { id: Number(req.headers["x-user-id"]) };
    next();
  });
  app.get("/limited", limiter, (req, res) => res.json({ success: true }));

  const { server, baseUrl } = await startServer(app);

  try {
    const requestAs = (userId) => fetch(`${baseUrl}/limited`, { headers: { "x-user-id": String(userId) } });

    assert.equal((await requestAs(1)).status, 200);
    assert.equal((await requestAs(1)).status, 200);

    const blockedResponse = await requestAs(1);
    assert.equal(blockedResponse.status, 429);
    assert.deepEqual(await blockedResponse.json(), { success: false, message: "Too many requests." });

    // Another user has an independent counter.
    assert.equal((await requestAs(2)).status, 200);
  } finally {
    server.close();
  }
});
