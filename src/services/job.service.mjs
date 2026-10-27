import jobModel from "../models/job.model.mjs";
import userModel from "../models/user.model.mjs";
import { AppError } from "../utils/app-error.mjs";
import { normalizeAddressInput } from "../utils/address.mjs";
import { getHomeLocation, resolveRouteFields, ROUTE_STATUS } from "./route-enrichment.service.mjs";

async function loadHomeLocation(userId) {
  const user = await userModel.findById(userId);

  return getHomeLocation(user);
}

async function createJob(userId, payload) {
  const companyAddress = normalizeAddressInput(payload.companyAddress);
  const home = companyAddress ? await loadHomeLocation(userId) : null;
  const { fields, outcome } = await resolveRouteFields({ companyAddress, home });

  const job = await jobModel.create({
    userId,
    companyName: payload.companyName,
    position: payload.position,
    status: payload.status || "applied",
    appliedDate: payload.appliedDate ? new Date(payload.appliedDate) : null,
    companyAddress,
    notes: payload.notes,
    ...fields,
  });

  return { job, route: outcome };
}

async function listJobs(userId, { status, search, page = 1, limit = 10 }) {
  const where = {
    userId,
    ...(status && { status }),
    ...(search && {
      OR: [
        { companyName: { contains: search } },
        { position: { contains: search } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    jobModel.findMany({ where, skip: (page - 1) * limit, take: Number(limit) }),
    jobModel.count(where),
  ]);

  return { items, total, page: Number(page), totalPages: Math.ceil(total / limit) };
}

async function getJobById(userId, id) {
  const job = await jobModel.findFirstByUser(Number(id), userId);
  if (!job) {
    throw new AppError("Application not found", 404, "JOB_NOT_FOUND");
  }
  return job;
}

async function updateJob(userId, id, payload) {
  const existingJob = await getJobById(userId, id);

  let data = {
    ...(payload.companyName !== undefined && { companyName: payload.companyName }),
    ...(payload.position !== undefined && { position: payload.position }),
    ...(payload.status !== undefined && { status: payload.status }),
    ...(payload.appliedDate !== undefined && { appliedDate: new Date(payload.appliedDate) }),
    ...(payload.notes !== undefined && { notes: payload.notes }),
  };

  let routeOutcome = { status: ROUTE_STATUS.UNCHANGED, geocodeAccuracy: null };

  if (payload.companyAddress !== undefined) {
    const companyAddress = normalizeAddressInput(payload.companyAddress);
    const home = companyAddress ? await loadHomeLocation(userId) : null;
    const { fields, outcome } = await resolveRouteFields({ companyAddress, existingJob, home });

    data = { ...data, companyAddress, ...fields };
    routeOutcome = outcome;
  }

  const job = await jobModel.update(Number(id), data);

  return { job, route: routeOutcome };
}

async function refreshJobRoute(userId, id) {
  const existingJob = await getJobById(userId, id);

  if (!normalizeAddressInput(existingJob.companyAddress)) {
    throw new AppError("This application has no company address.", 422, "COMPANY_ADDRESS_MISSING");
  }

  const home = await loadHomeLocation(userId);
  const { fields, outcome } = await resolveRouteFields({
    companyAddress: existingJob.companyAddress,
    existingJob,
    home,
    forceRouteRecalculation: true,
  });

  if (outcome.status === ROUTE_STATUS.SERVICE_UNAVAILABLE) {
    throw new AppError(
      "The map service is temporarily unavailable. Please try again later.",
      503,
      "MAP_SERVICE_UNAVAILABLE"
    );
  }

  const job = await jobModel.update(existingJob.id, fields);

  return { job, route: outcome };
}

async function deleteJob(userId, id) {
  await getJobById(userId, id);
  return jobModel.remove(Number(id));
}

export { createJob, listJobs, getJobById, updateJob, refreshJobRoute, deleteJob };
