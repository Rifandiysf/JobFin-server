import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { installFetchMock, jsonResponse } from "./helpers/fetch-mock.mjs";

process.env.MAP_MIN_REQUEST_INTERVAL_MS = "0";

const { resolveRouteFields, getHomeLocation, ROUTE_STATUS } = await import(
  "../src/services/route-enrichment.service.mjs"
);
const { resetGeocodeCache } = await import("../src/services/geocoding.service.mjs");

const HOME = { lat: -6.9, lng: 107.6 };
const GEOCODE_RESULT = { lat: "-6.2600000", lon: "106.8100000", display_name: "Jalan Kemang", place_rank: 26 };
const ROUTE_PAYLOAD = {
  code: "Ok",
  routes: [{ distance: 150000, duration: 7200, geometry: { coordinates: [[107.6, -6.9], [106.81, -6.26]] } }],
};

/** Routes each request to the matching fake upstream service. */
function mockMapServices({ geocode = () => jsonResponse([GEOCODE_RESULT]), route = () => jsonResponse(ROUTE_PAYLOAD) } = {}) {
  return installFetchMock((url) => (url.includes("/search") ? geocode() : route()));
}

beforeEach(() => resetGeocodeCache());

test("calculates coordinates and route for a new address", async () => {
  mockMapServices();

  const { fields, outcome } = await resolveRouteFields({ companyAddress: "Jl. Kemang, Jakarta", home: HOME });

  assert.equal(outcome.status, ROUTE_STATUS.CALCULATED);
  assert.equal(outcome.geocodeAccuracy, "street");
  assert.equal(fields.companyLat, -6.26);
  assert.equal(fields.distanceKm, 150);
  assert.equal(fields.durationMin, 120);
  assert.ok(fields.routeFetchedAt instanceof Date);
});

test("sends no request when the address is unchanged and a route exists", async () => {
  const calls = mockMapServices();
  const existingJob = {
    companyAddress: "Jl. Kemang, Jakarta",
    companyLat: -6.26,
    companyLng: 106.81,
    distanceKm: 150,
  };

  const { fields, outcome } = await resolveRouteFields({
    companyAddress: "  jl. kemang,  jakarta ",
    existingJob,
    home: HOME,
  });

  assert.equal(calls.length, 0);
  assert.deepEqual(fields, {});
  assert.equal(outcome.status, ROUTE_STATUS.UNCHANGED);
});

test("reuses stored coordinates and only requests a route when forced", async () => {
  const calls = mockMapServices();
  const existingJob = { companyAddress: "Jl. Kemang, Jakarta", companyLat: -6.26, companyLng: 106.81, distanceKm: 99 };

  const { fields, outcome } = await resolveRouteFields({
    companyAddress: existingJob.companyAddress,
    existingJob,
    home: HOME,
    forceRouteRecalculation: true,
  });

  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes("/route/v1/"));
  assert.equal(fields.distanceKm, 150);
  assert.equal(outcome.status, ROUTE_STATUS.CALCULATED);
});

test("stores only coordinates when the user has no home address", async () => {
  const calls = mockMapServices();

  const { fields, outcome } = await resolveRouteFields({ companyAddress: "Jl. Kemang, Jakarta", home: null });

  assert.equal(calls.length, 1); // geocoding only, no routing request
  assert.equal(outcome.status, ROUTE_STATUS.HOME_ADDRESS_MISSING);
  assert.equal(fields.companyLat, -6.26);
  assert.equal(fields.distanceKm, null);
});

test("clears every location field when the address is removed", async () => {
  const calls = mockMapServices();

  const { fields, outcome } = await resolveRouteFields({ companyAddress: "   ", home: HOME });

  assert.equal(calls.length, 0);
  assert.equal(outcome.status, ROUTE_STATUS.NOT_APPLICABLE);
  assert.deepEqual(fields, {
    companyLat: null,
    companyLng: null,
    distanceKm: null,
    durationMin: null,
    routeGeometry: null,
    routeFetchedAt: null,
  });
});

test("reports an unknown address and clears the stale route instead of throwing", async () => {
  mockMapServices({ geocode: () => jsonResponse([]) });

  const { fields, outcome } = await resolveRouteFields({
    companyAddress: "Unknown Street 1",
    existingJob: { companyAddress: "Old address", companyLat: 1, companyLng: 2, distanceKm: 5 },
    home: HOME,
  });

  assert.equal(outcome.status, ROUTE_STATUS.ADDRESS_NOT_FOUND);
  assert.equal(fields.companyLat, null);
  assert.equal(fields.distanceKm, null);
});

test("keeps the application saveable when the geocoding service is down", async () => {
  mockMapServices({ geocode: () => jsonResponse({}, { status: 503, headers: { "retry-after": "0" } }) });

  const { outcome } = await resolveRouteFields({ companyAddress: "Jl. Kemang, Jakarta", home: HOME });

  assert.equal(outcome.status, ROUTE_STATUS.SERVICE_UNAVAILABLE);
});

test("keeps the existing route of an unchanged address when routing is down", async () => {
  mockMapServices({ route: () => jsonResponse({}, { status: 503, headers: { "retry-after": "0" } }) });
  const existingJob = { companyAddress: "Jl. Kemang, Jakarta", companyLat: -6.26, companyLng: 106.81, distanceKm: 99 };

  const { fields, outcome } = await resolveRouteFields({
    companyAddress: existingJob.companyAddress,
    existingJob,
    home: HOME,
    forceRouteRecalculation: true,
  });

  assert.equal(outcome.status, ROUTE_STATUS.SERVICE_UNAVAILABLE);
  assert.equal("distanceKm" in fields, false); // the stored route is left untouched
});

test("keeps coordinates but clears the route when no drivable route exists", async () => {
  mockMapServices({ route: () => jsonResponse({ code: "NoRoute" }) });

  const { fields, outcome } = await resolveRouteFields({ companyAddress: "Jl. Kemang, Jakarta", home: HOME });

  assert.equal(outcome.status, ROUTE_STATUS.NO_ROUTE_FOUND);
  assert.equal(fields.companyLat, -6.26);
  assert.equal(fields.distanceKm, null);
});

test("rejects an oversized address as a validation error", async () => {
  mockMapServices();

  await assert.rejects(resolveRouteFields({ companyAddress: "a".repeat(300), home: HOME }), {
    statusCode: 422,
    reason: "INVALID_ADDRESS",
  });
});

test("reads the home location from Prisma decimal-like values", () => {
  assert.deepEqual(getHomeLocation({ homeLat: "-6.9000000", homeLng: "107.6000000" }), HOME);
  assert.equal(getHomeLocation({ homeLat: null, homeLng: null }), null);
  assert.equal(getHomeLocation(null), null);
});
