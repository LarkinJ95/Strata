import "server-only";
import { db } from "@/lib/db";
import { inspectionScheduleFor } from "@/lib/inspection-lifecycle";

/**
 * Synchronize a building only forward from its newest completed inspection.
 * A later stored building date is retained as a guard against legacy records
 * that are not represented by an Inspection row.
 */
export async function syncBuildingInspectionSchedule(buildingId: string) {
  const [building, latest] = await Promise.all([
    db.building.findUnique({
      where: { id: buildingId },
      select: { id: true, lastInspectionAt: true, nextInspectionAt: true, inspectionIntervalDays: true },
    }),
    db.inspection.findFirst({
      where: { buildingId, status: "completed", completedAt: { not: null, lte: new Date() } },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    }),
  ]);
  if (!building || !latest?.completedAt) return { updated: false, reason: "no_completed_inspection" as const };

  // Never let a historical record pull an existing newer date backwards.
  if (building.lastInspectionAt && building.lastInspectionAt > latest.completedAt) {
    return { updated: false, reason: "newer_building_date_retained" as const, completedAt: latest.completedAt };
  }

  const schedule = inspectionScheduleFor(latest.completedAt, building.inspectionIntervalDays);
  const changed =
    !building.lastInspectionAt ||
    building.lastInspectionAt.getTime() !== schedule.lastInspectionAt.getTime() ||
    !building.nextInspectionAt ||
    building.nextInspectionAt.getTime() !== schedule.nextInspectionAt.getTime();
  if (changed) await db.building.update({ where: { id: building.id }, data: schedule });
  return { updated: changed, reason: changed ? "synchronized" as const : "already_current" as const, completedAt: latest.completedAt };
}
