import { Prisma } from "@prisma/client";
import prisma from "../utils/prisma.client.mjs";

function normalizeJsonFields(data) {
  return data.routeGeometry === null ? { ...data, routeGeometry: Prisma.DbNull } : data;
}

function create(data) {
  return prisma.jobApplication.create({ data: normalizeJsonFields(data) });
}

function findMany({ where, skip, take }) {
  return prisma.jobApplication.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

function count(where) {
  return prisma.jobApplication.count({ where });
}

function findFirstByUser(id, userId) {
  return prisma.jobApplication.findFirst({ where: { id, userId } });
}

function update(id, data) {
  return prisma.jobApplication.update({ where: { id }, data: normalizeJsonFields(data) });
}

function remove(id) {
  return prisma.jobApplication.delete({ where: { id } });
}

function groupByStatus(userId) {
  return prisma.jobApplication.groupBy({
    by: ["status"],
    where: { userId },
    _count: { status: true },
  });
}

function findAddressedByUser(userId, take) {
  return prisma.jobApplication.findMany({
    where: { userId, companyAddress: { not: null } },
    select: { id: true, companyAddress: true, companyLat: true, companyLng: true, distanceKm: true },
    orderBy: { createdAt: "desc" },
    take,
  });
}

function averageDistance(userId) {
  return prisma.jobApplication.aggregate({
    where: { userId, distanceKm: { not: null } },
    _avg: { distanceKm: true },
  });
}

function findAppliedDatesByUser(userId) {
  return prisma.jobApplication.findMany({
    where: { userId, appliedDate: { not: null } },
    select: { appliedDate: true },
  });
}

export default {
  create,
  findMany,
  count,
  findFirstByUser,
  update,
  remove,
  groupByStatus,
  findAddressedByUser,
  averageDistance,
  findAppliedDatesByUser,
};
