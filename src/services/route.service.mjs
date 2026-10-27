import { mapConfig } from "../config/map.config.mjs";
import { AppError } from "../utils/app-error.mjs";
import { createRequestThrottle } from "../utils/request-throttle.mjs";
import { requestJson } from "../utils/upstream-request.mjs";

const GEOMETRY_COORDINATE_DECIMALS = 5;

const osrmThrottle = createRequestThrottle({
  minIntervalMs: mapConfig.minRequestIntervalMs,
  maxQueuedRequests: mapConfig.maxQueuedRequests,
});

function roundCoordinate(coordinate) {
  return Number(coordinate.toFixed(GEOMETRY_COORDINATE_DECIMALS));
}

function assertValidPoint(latitude, longitude, pointName) {
  const isValid =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;

  if (!isValid) {
    throw new AppError(`The ${pointName} coordinates are invalid.`, 422, "INVALID_COORDINATES");
  }
}

async function calculateRoute({ fromLat, fromLng, toLat, toLng }) {
  assertValidPoint(fromLat, fromLng, "origin");
  assertValidPoint(toLat, toLng, "destination");

  const parameters = new URLSearchParams({ overview: "full", geometries: "geojson" });
  const coordinatePath = `${fromLng},${fromLat};${toLng},${toLat}`;

  const payload = await requestJson({
    url: `${mapConfig.osrmUrl}/${coordinatePath}?${parameters}`,
    throttle: osrmThrottle,
    serviceName: "routing service",
  });

  if (payload?.code !== "Ok" || !payload.routes?.length) {
    throw new AppError("Unable to calculate a route for these coordinates.", 422, "NO_ROUTE_FOUND");
  }

  const [bestRoute] = payload.routes;

  return {
    distanceKm: Number((bestRoute.distance / 1000).toFixed(2)),
    durationMin: Math.round(bestRoute.duration / 60),
    geometry: bestRoute.geometry.coordinates.map(([longitude, latitude]) => [
      roundCoordinate(longitude),
      roundCoordinate(latitude),
    ]),
  };
}

export { calculateRoute };
export { geocodeAddress } from "./geocoding.service.mjs";
