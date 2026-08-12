import { db } from "./db";
import type { SessionUser } from "./types";
import { buildingWhere, dataScope } from "./auth";

export async function dashboardData(user: SessionUser) {
  const scope = dataScope(user);
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const soon60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const [
    clients,
    facilities,
    buildings,
    inventory,
    openRepairs,
    overdueRepairs,
    awaitingVerify,
    overdueInspections,
    upcomingInspections,
    pendingLab,
    unreconciled,
    damagedAcm,
    recentActivity,
    recentSamples,
    recentRemovals,
  ] = await Promise.all([
    db.client.count({ where: { organizationId: user.organizationId, ...(user.clientId ? { id: user.clientId } : {}) } }),
    db.facility.count({ where: { organizationId: user.organizationId, ...(user.clientId ? { clientId: user.clientId } : {}) } }),
    db.building.count({ where: buildingWhere(user) }),
    db.inventoryItem.count({ where: { ...scope, recordStatus: "active" } }),
    db.repair.count({ where: { ...scope, status: { in: ["open", "assigned", "scheduled", "in_progress"] } } }),
    db.repair.count({
      where: {
        ...scope,
        status: { in: ["open", "assigned", "scheduled", "in_progress"] },
        scheduledDate: { lt: now },
      },
    }),
    db.repair.count({ where: { ...scope, status: "awaiting_verification" } }),
    db.building.count({ where: { ...scope, nextInspectionAt: { lt: now } } }),
    db.building.findMany({
      where: { ...buildingWhere(user), nextInspectionAt: { gte: now, lte: soon60 } },
      include: { client: true, facility: true },
      orderBy: { nextInspectionAt: "asc" },
      take: 8,
    }),
    db.sample.count({ where: { ...scope, status: { in: ["collected", "submitted", "at_lab"] } } }),
    db.sample.count({ where: { ...scope, status: { in: ["results_received", "reviewed"] } } }),
    db.inventoryItem.findMany({
      where: {
        ...scope,
        recordStatus: "active",
        acmClassification: { in: ["confirmed_acm", "assumed_acm", "pacm"] },
        condition: { in: ["damaged", "significantly_damaged", "needs_repair"] },
      },
      include: { building: true },
      take: 10,
      orderBy: { updatedAt: "desc" },
    }),
    db.activityEvent.findMany({
      where: { organizationId: user.organizationId, ...(user.clientId ? { clientId: user.clientId } : {}) },
      include: { actor: true, building: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    db.sample.findMany({
      where: scope,
      include: { building: true },
      orderBy: { collectionDate: "desc" },
      take: 5,
    }),
    db.removalEvent.findMany({
      where: { organizationId: user.organizationId },
      include: { building: true, inventoryItem: true },
      orderBy: { removedAt: "desc" },
      take: 5,
    }),
  ]);

  const overdueBuildingList = await db.building.findMany({
    where: { ...buildingWhere(user), nextInspectionAt: { lt: now } },
    include: { client: true, facility: true },
    orderBy: { nextInspectionAt: "asc" },
  });

  return {
    portfolio: { clients, facilities, buildings, inventory, openRepairs },
    action: {
      overdueInspections,
      overdueRepairs,
      damagedAcm: damagedAcm.length,
      awaitingVerify,
      pendingLab,
      unreconciled,
    },
    upcomingInspections,
    overdueBuildingList,
    damagedItems: damagedAcm,
    recentActivity,
    recentSamples,
    recentRemovals,
    soon,
  };
}

export async function queueData(user: SessionUser) {
  const scope = dataScope(user);
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    overdueInspections,
    upcomingInspections,
    damaged,
    suspects,
    pendingLab,
    unreconciled,
    openRepairs,
    overdueRepairs,
    awaiting,
    drafts,
  ] = await Promise.all([
    db.building.findMany({
      where: { ...buildingWhere(user), nextInspectionAt: { lt: now } },
      include: { client: true, facility: true },
      orderBy: { nextInspectionAt: "asc" },
    }),
    db.building.findMany({
      where: { ...buildingWhere(user), nextInspectionAt: { gte: now, lte: soon } },
      include: { client: true, facility: true },
      orderBy: { nextInspectionAt: "asc" },
    }),
    db.inventoryItem.findMany({
      where: {
        ...scope,
        recordStatus: "active",
        acmClassification: { in: ["confirmed_acm", "assumed_acm", "pacm"] },
        condition: { in: ["damaged", "significantly_damaged", "needs_repair"] },
      },
      include: { building: true, client: true },
      orderBy: { condition: "asc" },
    }),
    db.inventoryItem.findMany({
      where: { ...scope, isProvisional: true, recordStatus: "active" },
      include: { building: true },
    }),
    db.sample.findMany({
      where: { ...scope, status: { in: ["collected", "submitted", "at_lab"] } },
      include: { building: true, inspector: true },
      orderBy: { collectionDate: "asc" },
    }),
    db.sample.findMany({
      where: { ...scope, status: { in: ["results_received", "reviewed"] } },
      include: { building: true, layers: { include: { result: true } } },
    }),
    db.repair.findMany({
      where: { ...scope, status: { in: ["open", "assigned", "scheduled", "in_progress"] } },
      include: { building: true, inventoryItem: true },
      orderBy: { priority: "asc" },
    }),
    db.repair.findMany({
      where: {
        ...scope,
        status: { in: ["open", "assigned", "scheduled", "in_progress"] },
        scheduledDate: { lt: now },
      },
      include: { building: true, inventoryItem: true },
    }),
    db.repair.findMany({
      where: { ...scope, status: "awaiting_verification" },
      include: { building: true, inventoryItem: true },
    }),
    db.inspection.findMany({
      where: { ...scope, status: { in: ["draft", "in_progress"] } },
      include: { building: true, inspector: true },
    }),
  ]);

  return {
    overdueInspections,
    upcomingInspections,
    damaged,
    suspects,
    pendingLab,
    unreconciled,
    openRepairs,
    overdueRepairs,
    awaiting,
    drafts,
  };
}

export async function inspectorWorkspace(user: SessionUser) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const mine = { organizationId: user.organizationId, inspectorId: user.id };

  return {
    today: await db.inspection.findMany({
      where: { ...mine, scheduledDate: { gte: start, lte: end } },
      include: { building: { include: { client: true } } },
    }),
    upcoming: await db.inspection.findMany({
      where: { ...mine, status: "scheduled", scheduledDate: { gt: end } },
      include: { building: { include: { client: true } } },
      orderBy: { scheduledDate: "asc" },
      take: 10,
    }),
    drafts: await db.inspection.findMany({
      where: { organizationId: user.organizationId, inspectorId: user.id, status: { in: ["draft", "in_progress"] } },
      include: { building: true },
    }),
    submitted: await db.inspection.findMany({
      where: { ...mine, status: { in: ["submitted", "completed"] } },
      include: { building: true },
      orderBy: { completedAt: "desc" },
      take: 8,
    }),
    pendingSamples: await db.sample.findMany({
      where: { organizationId: user.organizationId, inspectorId: user.id, status: { in: ["collected", "submitted", "at_lab"] } },
      include: { building: true },
    }),
    verify: await db.repair.findMany({
      where: { organizationId: user.organizationId, status: "awaiting_verification" },
      include: { building: true, inventoryItem: true },
    }),
  };
}
