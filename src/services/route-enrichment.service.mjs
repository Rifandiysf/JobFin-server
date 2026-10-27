import { AppError } from "../utils/app-error.mjs";
import { isSameAddress, normalizeAddressInput } from "../utils/address.mjs";
import { geocodeAddress } from "./geocoding.service.mjs";
import { calculateRoute } from "./route.service.mjs";

const ROUTE_STATUS = Object.freeze({
  CALCULATED: "calculated",
  UNCHANGED: "unchanged",
  NOT_APPLICABLE: "not_applicable",
  HOME_ADDRESS_MISSING: "home_address_missing",
  ADDRESS_NOT_FOUND: "address_not_found",
  NO_ROUTE_FOUND: "no_route_found",
  SERVICE_UNAVAILABLE: "service_unavailable",
});

const FAILURE_STATUS_BY_REASON = Object.freeze({
  ADDRESS_NOT_FOUND: ROUTE_STATUS.ADDRESS_NOT_FOUND,
  NO_ROUTE_FOUND: ROUTE_STATUS.NO_ROUTE_FOUND,
  MAP_SERVICE_UNAVAILABLE: ROUTE_STATUS.SERVICE_UNAVAILABLE,
  MAP_SERVICE_BUSY: ROUTE_STATUS.SERVICE_UNAVAILABLE,
});

const CLEARED_COORDINATE_FIELDS = Object.freeze({ companyLat: null, companyLng: null });
const CLEARED_ROUTE_FIELDS = Object.freeze({
  distanceKm: null,
  durationMin: null,
  routeGeometry: null,
  routeFetchedAt: null,
});

function createOutcome(status, geocodeAccuracy = null) {
  return { status, geocodeAccuracy };
}

function getHomeLocation(user) {
  const lat = user?.homeLat === null || user?.homeLat === undefined ? Number.NaN : Number(user.homeLat);
  const lng = user?.homeLng === null || user?.homeLng === undefined ? Number.NaN : Number(user.homeLng);

  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function toFailureStatus(error) {
  const status = error instanceof AppError ? FAILURE_STATUS_BY_REASON[error.reason] : undefined;

  if (!status) throw error;

  return status;
}

async function resolveRouteFields({
  companyAddress,
  existingJob = null,
  home = null,
  forceRouteRecalculation = false,
}) {
  const normalizedAddress = normalizeAddressInput(companyAddress);

  if (!normalizedAddress) {
    return {
      fields: { ...CLEARED_COORDINATE_FIELDS, ...CLEARED_ROUTE_FIELDS },
      outcome: createOutcome(ROUTE_STATUS.NOT_APPLICABLE),
    };
  }

  const hasStoredCoordinates =
    existingJob?.companyLat !== null &&
    existingJob?.companyLat !== undefined &&
    existingJob?.companyLng !== null &&
    existingJob?.companyLng !== undefined;
  const isUnchangedAddress = hasStoredCoordinates && isSameAddress(existingJob.companyAddress, normalizedAddress);

  if (isUnchangedAddress && !forceRouteRecalculation && existingJob.distanceKm !== null) {
    return { fields: {}, outcome: createOutcome(ROUTE_STATUS.UNCHANGED) };
  }

  let coordinates;
  let geocodeAccuracy = null;

  if (isUnchangedAddress) {
    coordinates = { lat: Number(existingJob.companyLat), lng: Number(existingJob.companyLng) };
  } else {
    try {
      const geocodedAddress = await geocodeAddress(normalizedAddress, { biasLocation: home });

      coordinates = geocodedAddress;
      geocodeAccuracy = geocodedAddress.accuracy;
    } catch (error) {
      return {
        fields: { ...CLEARED_COORDINATE_FIELDS, ...CLEARED_ROUTE_FIELDS },
        outcome: createOutcome(toFailureStatus(error)),
      };
    }
  }

  const coordinateFields = { companyLat: coordinates.lat, companyLng: coordinates.lng };

  if (!home) {
    return {
      fields: { ...coordinateFields, ...CLEARED_ROUTE_FIELDS },
      outcome: createOutcome(ROUTE_STATUS.HOME_ADDRESS_MISSING, geocodeAccuracy),
    };
  }

  try {
    const route = await calculateRoute({
      fromLat: home.lat,
      fromLng: home.lng,
      toLat: coordinates.lat,
      toLng: coordinates.lng,
    });

    return {
      fields: {
        ...coordinateFields,
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        routeGeometry: route.geometry,
        routeFetchedAt: new Date(),
      },
      outcome: createOutcome(ROUTE_STATUS.CALCULATED, geocodeAccuracy),
    };
  } catch (error) {
    const status = toFailureStatus(error);
    const shouldClearRoute = status === ROUTE_STATUS.NO_ROUTE_FOUND || !isUnchangedAddress;

    return {
      fields: shouldClearRoute ? { ...coordinateFields, ...CLEARED_ROUTE_FIELDS } : coordinateFields,
      outcome: createOutcome(status, geocodeAccuracy),
    };
  }
}

export { resolveRouteFields, getHomeLocation, ROUTE_STATUS };
