import { mapConfig } from "../config/map.config.mjs";
import { AppError } from "../utils/app-error.mjs";
import { collapseWhitespace, normalizeAddressInput } from "../utils/address.mjs";
import { createRequestThrottle } from "../utils/request-throttle.mjs";
import { createTtlCache } from "../utils/ttl-cache.mjs";
import { requestJson } from "../utils/upstream-request.mjs";

const GEOCODE_ACCURACY = Object.freeze({
  BUILDING: "building",
  STREET: "street",
  AREA: "area",
});

const BUILDING_MIN_PLACE_RANK = 28;
const STREET_MIN_PLACE_RANK = 26;
const MAX_CANDIDATES_PER_REQUEST = 5;

const nominatimThrottle = createRequestThrottle({
  minIntervalMs: mapConfig.minRequestIntervalMs,
  maxQueuedRequests: mapConfig.maxQueuedRequests,
});

const geocodeCache = createTtlCache({
  maxEntries: mapConfig.geocodeCacheMaxEntries,
  defaultTtlMs: mapConfig.geocodeCacheTtlMs,
});

function cleanQuery(query) {
  return collapseWhitespace(query)
    .replace(/\s*,\s*/g, ",")
    .replace(/,{2,}/g, ",")
    .replace(/^,|,$/g, "")
    .replace(/,/g, ", ")
    .trim();
}

function expandStreetAbbreviations(address) {
  return address.replace(/\bjl(?:n)?\b\.?\s*/gi, "Jalan ").replace(/\bgg\b\.?\s*/gi, "Gang ");
}

const HOUSE_NUMBER_AND_FLOOR_PATTERN =
  /\b(?:no|nomor)\b\.?\s*[\w./-]*\d[\w./-]*|\b(?:lt|lantai)\b\.?\s*\d+\b/gi;

const ADMINISTRATIVE_PATTERNS = [
  /\b(?:kec|kecamatan|kel|kelurahan)\b\.?\s*[^,]+,?/gi,
  /\brt\b\.?\s*\d+(?:\s*\/?\s*rw\b\.?\s*\d+)?/gi,
  /\brw\b\.?\s*\d+/gi,
  /\b\d{5}\b/g,
];

function buildQueryVariants(address) {
  const fullQuery = expandStreetAbbreviations(address);
  const withoutHouseNumber = fullQuery.replace(HOUSE_NUMBER_AND_FLOOR_PATTERN, " ");
  const withoutAdministrativeParts = ADMINISTRATIVE_PATTERNS.reduce(
    (query, pattern) => query.replace(pattern, " "),
    withoutHouseNumber
  );

  const variants = [fullQuery, withoutHouseNumber, withoutAdministrativeParts]
    .map(cleanQuery)
    .filter((query) => query.length >= 3);

  return [...new Set(variants)];
}

function isValidLocation(location) {
  return (
    Number.isFinite(location?.lat) &&
    Number.isFinite(location?.lng) &&
    Math.abs(location.lat) <= 90 &&
    Math.abs(location.lng) <= 180
  );
}

function buildViewbox({ lat, lng }) {
  const radius = mapConfig.geocodeBiasRadiusDegrees;

  return [lng - radius, lat + radius, lng + radius, lat - radius]
    .map((coordinate) => coordinate.toFixed(5))
    .join(",");
}

function resolveAccuracy(placeRank) {
  if (placeRank >= BUILDING_MIN_PLACE_RANK) return GEOCODE_ACCURACY.BUILDING;
  if (placeRank >= STREET_MIN_PLACE_RANK) return GEOCODE_ACCURACY.STREET;

  return GEOCODE_ACCURACY.AREA;
}

function toCandidate(result) {
  const lat = Number.parseFloat(result?.lat);
  const lng = Number.parseFloat(result?.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    lat,
    lng,
    displayName: result.display_name,
    accuracy: resolveAccuracy(Number(result.place_rank)),
  };
}


function pickBestCandidate(candidates) {
  return candidates.find((candidate) => candidate.accuracy !== GEOCODE_ACCURACY.AREA) ?? candidates[0];
}

async function searchNominatim(query, biasLocation) {
  const parameters = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: String(MAX_CANDIDATES_PER_REQUEST),
    countrycodes: "id",
  });

  if (biasLocation) parameters.set("viewbox", buildViewbox(biasLocation));

  const results = await requestJson({
    url: `${mapConfig.nominatimUrl}?${parameters}`,
    throttle: nominatimThrottle,
    serviceName: "geocoding service",
    headers: { "Accept-Language": "id" },
  });

  return Array.isArray(results) ? results : [];
}

function createAddressNotFoundError(address) {
  return new AppError(
    `Address "${address}" could not be found. Try adding the street name and city.`,
    422,
    "ADDRESS_NOT_FOUND"
  );
}

function buildCacheKey(normalizedAddress, biasLocation) {
  const biasKey = biasLocation ? `${biasLocation.lat.toFixed(1)},${biasLocation.lng.toFixed(1)}` : "none";

  return `${normalizedAddress.toLowerCase()}|${biasKey}`;
}

async function geocodeAddress(address, { biasLocation } = {}) {
  const normalizedAddress = normalizeAddressInput(address);

  if (!normalizedAddress) {
    throw new AppError("Address is required.", 422, "INVALID_ADDRESS");
  }

  const validBiasLocation = isValidLocation(biasLocation) ? biasLocation : null;
  const cacheKey = buildCacheKey(normalizedAddress, validBiasLocation);
  const cachedResult = geocodeCache.get(cacheKey);

  if (cachedResult === null) throw createAddressNotFoundError(normalizedAddress);
  if (cachedResult) return { ...cachedResult };

  for (const query of buildQueryVariants(normalizedAddress)) {
    const rawResults = await searchNominatim(query, validBiasLocation);
    const candidates = rawResults.map(toCandidate).filter(Boolean);

    if (candidates.length === 0) continue;

    const bestCandidate = pickBestCandidate(candidates);

    geocodeCache.set(cacheKey, bestCandidate);

    return { ...bestCandidate };
  }

  geocodeCache.set(cacheKey, null, mapConfig.geocodeNotFoundCacheTtlMs);

  throw createAddressNotFoundError(normalizedAddress);
}

function resetGeocodeCache() {
  geocodeCache.clear();
}

export { geocodeAddress, resetGeocodeCache, buildQueryVariants, GEOCODE_ACCURACY };
