export type InspectionConditionSummary = "good" | "needs_repair" | "no_results";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The inspection record is the source of truth here. Do not use the current
 * inventory condition: a later inspection may have changed it.
 */
export function summarizeInspectionConditions(
  conditions: Array<string | null | undefined>
): InspectionConditionSummary {
  const recorded = conditions.filter((condition): condition is string => Boolean(condition));
  if (!recorded.length) return "no_results";
  return recorded.every((condition) => condition === "good") ? "good" : "needs_repair";
}

export function latestCompletedInspectionDate(
  dates: Array<Date | null | undefined>
): Date | null {
  const valid = dates.filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()));
  if (!valid.length) return null;
  return new Date(Math.max(...valid.map((date) => date.getTime())));
}

export function inspectionScheduleFor(
  completedAt: Date,
  inspectionIntervalDays?: number | null
) {
  const intervalDays = inspectionIntervalDays && inspectionIntervalDays > 0 ? inspectionIntervalDays : 365;
  return {
    lastInspectionAt: new Date(completedAt),
    nextInspectionAt: new Date(completedAt.getTime() + intervalDays * DAY_MS),
  };
}
