const DEFAULT_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const DEFAULT_OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const DEVELOPMENT_USER_AGENT = "JobFin/1.0 (development)";

const MINUTE_IN_MS = 60 * 1000;
const DAY_IN_MS = 24 * 60 * MINUTE_IN_MS;

function readNonNegativeInteger(variableName, fallbackValue) {
    const rawValue = process.env[variableName];

    if (rawValue === undefined || rawValue === "") return fallbackValue;

    const parsedValue = Number(rawValue);

    if (!Number.isInteger(parsedValue) || parsedValue < 0) {
        throw new Error(`Environment variable ${variableName} must be a non-negative integer.`);
    }

    return parsedValue;
}

function readUserAgent() {
    const configuredUserAgent = process.env.MAP_USER_AGENT?.trim();

    if (configuredUserAgent) return configuredUserAgent;

    if (process.env.NODE_ENV === "production") {
        throw new Error(
            'MAP_USER_AGENT is required in production. Example: "JobFin/1.0 (contact: you@example.com)".'
        );
    }

    return DEVELOPMENT_USER_AGENT;
}

const mapConfig = Object.freeze({
    nominatimUrl: process.env.NOMINATIM_URL?.trim() || DEFAULT_NOMINATIM_URL,
    osrmUrl: process.env.OSRM_URL?.trim() || DEFAULT_OSRM_URL,
    userAgent: readUserAgent(),

    minRequestIntervalMs: readNonNegativeInteger("MAP_MIN_REQUEST_INTERVAL_MS", 1100),
    requestTimeoutMs: 8000,
    maxQueuedRequests: 10,

    geocodeCacheMaxEntries: 1000,
    geocodeCacheTtlMs: 30 * DAY_IN_MS,
    geocodeNotFoundCacheTtlMs: 10 * MINUTE_IN_MS,

    geocodeBiasRadiusDegrees: 0.6,

    maxJobsPerRouteRefresh: 100,
});

export { mapConfig };