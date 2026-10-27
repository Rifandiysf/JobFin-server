import { mapConfig } from "../config/map.config.mjs";
import jobModel from "../models/job.model.mjs";
import userModel from "../models/user.model.mjs";
import { getHomeLocation, resolveRouteFields, ROUTE_STATUS } from "./route-enrichment.service.mjs";

const REFRESH_STATUS = Object.freeze({
  QUEUED: "queued",
  ALREADY_RUNNING: "already_running",
});

const activeUserIds = new Set();
const rerunRequestedUserIds = new Set();

async function refreshRoutesOnce(userId) {
  const user = await userModel.findById(userId);
  const home = getHomeLocation(user);

  if (!home) return;

  const jobs = await jobModel.findAddressedByUser(userId, mapConfig.maxJobsPerRouteRefresh);

  for (const job of jobs) {
    if (rerunRequestedUserIds.has(userId)) return;

    const { fields, outcome } = await resolveRouteFields({
      companyAddress: job.companyAddress,
      existingJob: job,
      home,
      forceRouteRecalculation: true,
    });

    if (outcome.status === ROUTE_STATUS.SERVICE_UNAVAILABLE) {
      console.warn(`[map] Route refresh stopped for user ${userId}: map service unavailable.`);
      return;
    }

    await jobModel.update(job.id, fields);
  }
}

async function runRouteRefresh(userId) {
  try {
    do {
      rerunRequestedUserIds.delete(userId);
      await refreshRoutesOnce(userId);
    } while (rerunRequestedUserIds.has(userId));
  } finally {
    activeUserIds.delete(userId);
  }
}

function queueRouteRefresh(userId) {
  if (activeUserIds.has(userId)) {
    rerunRequestedUserIds.add(userId);
    return REFRESH_STATUS.ALREADY_RUNNING;
  }

  activeUserIds.add(userId);

  runRouteRefresh(userId).catch((error) => {
    console.error(`[map] Route refresh failed for user ${userId}:`, error);
  });

  return REFRESH_STATUS.QUEUED;
}

export { queueRouteRefresh, REFRESH_STATUS };
