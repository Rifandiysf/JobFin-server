import jobModel from "../models/job.model.mjs";

async function getSummary(userId) {
  const [total, byStatus, avgDistance, appliedDates] = await Promise.all([
    jobModel.count({ userId }),
    jobModel.groupByStatus(userId),
    jobModel.averageDistance(userId),
    jobModel.findAppliedDatesByUser(userId),
  ]);

  const trendMap = {};
  for (const { appliedDate } of appliedDates) {
    const key = appliedDate.toISOString().slice(0, 7);
    trendMap[key] = (trendMap[key] || 0) + 1;
  }

  return {
    totalApplications: total,
    byStatus: byStatus.map((statusGroup) => ({ status: statusGroup.status, count: statusGroup._count.status })),
    averageDistanceKm: avgDistance._avg.distanceKm
      ? Number(avgDistance._avg.distanceKm.toFixed(2))
      : null,
    monthlyTrend: Object.entries(trendMap)
      .sort(([firstMonth], [secondMonth]) => firstMonth.localeCompare(secondMonth))
      .map(([month, count]) => ({ month, count })),
  };
}

export default { getSummary };
