import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { installFetchMock, jsonResponse } from "./helpers/fetch-mock.mjs";

process.env.MAP_MIN_REQUEST_INTERVAL_MS = "0";

const { geocodeAddress, resetGeocodeCache, buildQueryVariants } = await import(
  "../src/services/geocoding.service.mjs"
);

const STREET_RESULT = { lat: "-6.2600000", lon: "106.8100000", display_name: "Jalan Kemang Selatan Raya", place_rank: 26 };
const AREA_RESULT = { lat: "-6.2700000", lon: "106.8200000", display_name: "Kemang, Jakarta Selatan", place_rank: 20 };
const BUILDING_RESULT = { lat: "-6.2610000", lon: "106.8110000", display_name: "Gedung Kemang 12", place_rank: 30 };

beforeEach(() => resetGeocodeCache());

test("returns coordinates and accuracy for a found address", async () => {
  installFetchMock(() => jsonResponse([BUILDING_RESULT]));

  const result = await geocodeAddress("Jl. Kemang Selatan Raya No. 12, Jakarta Selatan");

  assert.deepEqual(result, {
    lat: -6.261,
    lng: 106.811,
    displayName: "Gedung Kemang 12",
    accuracy: "building",
  });
});

test("identifies the application and prefers results near the bias location", async () => {
  const calls = installFetchMock(() => jsonResponse([STREET_RESULT]));

  await geocodeAddress("Jl. Merdeka, Jakarta", { biasLocation: { lat: -6.2, lng: 106.8 } });

  const requestUrl = new URL(calls[0].url);

  assert.match(calls[0].options.headers["User-Agent"], /JobFin/);
  assert.equal(requestUrl.searchParams.get("countrycodes"), "id");
  assert.equal(requestUrl.searchParams.get("q"), "Jalan Merdeka, Jakarta");
  // west,north,east,south around the bias location
  assert.equal(requestUrl.searchParams.get("viewbox"), "106.20000,-5.60000,107.40000,-6.80000");
});

test("skips a coarse area result when a street-level result is available", async () => {
  installFetchMock(() => jsonResponse([AREA_RESULT, STREET_RESULT]));

  const result = await geocodeAddress("Kemang Selatan Raya");

  assert.equal(result.accuracy, "street");
  assert.equal(result.displayName, "Jalan Kemang Selatan Raya");
});

test("keeps an area result when nothing more precise exists", async () => {
  installFetchMock(() => jsonResponse([AREA_RESULT]));

  const result = await geocodeAddress("Kemang, Jakarta");

  assert.equal(result.accuracy, "area");
});

test("only sends a looser query when the previous one found nothing", async () => {
  const calls = installFetchMock((url, callNumber) =>
    callNumber === 1 ? jsonResponse([]) : jsonResponse([STREET_RESULT])
  );

  const result = await geocodeAddress("Jl. Kemang Selatan Raya No. 12, Kec. Mampang, Jakarta Selatan 12730");

  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[1].url).searchParams.get("q"), "Jalan Kemang Selatan Raya, Kec. Mampang, Jakarta Selatan 12730");
  assert.equal(result.accuracy, "street");
});

test("answers repeated lookups from the cache without a new request", async () => {
  const calls = installFetchMock(() => jsonResponse([STREET_RESULT]));

  await geocodeAddress("Jl. Kemang Selatan Raya, Jakarta");
  await geocodeAddress("  jl. kemang   selatan raya, JAKARTA ");

  assert.equal(calls.length, 1);
});

test("fails with 422 and remembers the miss for a short time", async () => {
  const calls = installFetchMock(() => jsonResponse([]));

  await assert.rejects(geocodeAddress("Nowhere Street 999"), { statusCode: 422, reason: "ADDRESS_NOT_FOUND" });
  const callsAfterFirstLookup = calls.length;

  await assert.rejects(geocodeAddress("Nowhere Street 999"), { statusCode: 422, reason: "ADDRESS_NOT_FOUND" });

  assert.equal(calls.length, callsAfterFirstLookup);
});

test("rejects empty and oversized addresses before any request", async () => {
  const calls = installFetchMock(() => jsonResponse([]));

  await assert.rejects(geocodeAddress("   "), { statusCode: 422, reason: "INVALID_ADDRESS" });
  await assert.rejects(geocodeAddress("a".repeat(300)), { statusCode: 422, reason: "INVALID_ADDRESS" });

  assert.equal(calls.length, 0);
});

test("builds query variants without damaging street names that contain abbreviations", () => {
  const variants = buildQueryVariants("Jl. Lt. Jend. S. Parman No. 5 Lt. 3, Jakarta");

  assert.equal(variants[0], "Jalan Lt. Jend. S. Parman No. 5 Lt. 3, Jakarta");
  // The house number and the floor are removed, but "Lt. Jend." stays.
  assert.equal(variants[1], "Jalan Lt. Jend. S. Parman, Jakarta");
});
