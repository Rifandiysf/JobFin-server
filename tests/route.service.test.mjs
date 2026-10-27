import assert from "node:assert/strict";
import { test } from "node:test";
import { installFetchMock, jsonResponse } from "./helpers/fetch-mock.mjs";

process.env.MAP_MIN_REQUEST_INTERVAL_MS = "0";

const { calculateRoute } = await import("../src/services/route.service.mjs");

const ROUTE_INPUT = { fromLat: -6.2, fromLng: 106.8, toLat: -6.3, toLng: 106.9 };

const OK_PAYLOAD = {
  code: "Ok",
  routes: [
    {
      distance: 12345,
      duration: 1530,
      geometry: { coordinates: [[106.8000049, -6.2000049], [106.9, -6.3]] },
    },
  ],
};

test("converts the OSRM response and rounds the geometry", async () => {
  const calls = installFetchMock(() => jsonResponse(OK_PAYLOAD));

  const route = await calculateRoute(ROUTE_INPUT);

  assert.equal(route.distanceKm, 12.35);
  assert.equal(route.durationMin, 26);
  assert.deepEqual(route.geometry, [[106.8, -6.2], [106.9, -6.3]]);
  // OSRM expects longitude first.
  assert.match(calls[0].url, /\/106\.8,-6\.2;106\.9,-6\.3\?/);
  assert.match(calls[0].options.headers["User-Agent"], /JobFin/);
});

test("fails with 422 when no route exists", async () => {
  installFetchMock(() => jsonResponse({ code: "NoRoute" }));

  await assert.rejects(calculateRoute(ROUTE_INPUT), { statusCode: 422, reason: "NO_ROUTE_FOUND" });
});

test("retries once after a temporary upstream failure", async () => {
  const calls = installFetchMock((url, callNumber) =>
    callNumber === 1
      ? jsonResponse({}, { status: 429, headers: { "retry-after": "0" } })
      : jsonResponse(OK_PAYLOAD)
  );

  const route = await calculateRoute(ROUTE_INPUT);

  assert.equal(calls.length, 2);
  assert.equal(route.distanceKm, 12.35);
});

test("reports 503 after the retry also fails", async () => {
  const calls = installFetchMock(() => jsonResponse({}, { status: 503, headers: { "retry-after": "0" } }));

  await assert.rejects(calculateRoute(ROUTE_INPUT), { statusCode: 503, reason: "MAP_SERVICE_UNAVAILABLE" });
  assert.equal(calls.length, 2);
});

test("does not retry a permanent client error", async () => {
  const calls = installFetchMock(() => jsonResponse({ code: "InvalidQuery" }, { status: 400 }));

  await assert.rejects(calculateRoute(ROUTE_INPUT), { statusCode: 503 });
  assert.equal(calls.length, 1);
});

test("rejects invalid coordinates without sending a request", async () => {
  const calls = installFetchMock(() => jsonResponse(OK_PAYLOAD));

  await assert.rejects(calculateRoute({ ...ROUTE_INPUT, fromLat: 123 }), { statusCode: 422, reason: "INVALID_COORDINATES" });
  assert.equal(calls.length, 0);
});
