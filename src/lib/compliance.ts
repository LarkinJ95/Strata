import { db } from "./db";

export type Compliance = {
  status: "current" | "attention" | "action";
  reasons: string[];
};

export async function evaluateBuilding(buildingId: string): Promise<Compliance> {
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const building = await db.building.findUnique({ where: { id: buildingId } });
  if (!building) return { status: "attention", reasons: ["Building not found"] };

  const [overdueRepairs, openRepairs, awaiting, damaged, pendingSamples, unreconciled] =
    await Promise.all([
      db.repair.count({
        where: {
          buildingId,
          status: { in: ["open", "assigned", "scheduled", "in_progress"] },
          scheduledDate: { lt: now },
        },
      }),
      db.repair.count({
        where: {
          buildingId,
          status: { in: ["open", "assigned", "scheduled", "in_progress"] },
        },
      }),
      db.repair.count({ where: { buildingId, status: "awaiting_verification" } }),
      db.inventoryItem.count({
        where: {
          buildingId,
          recordStatus: "active",
          acmClassification: { in: ["confirmed_acm", "assumed_acm", "pacm"] },
          condition: { in: ["damaged", "significantly_damaged", "needs_repair"] },
        },
      }),
      db.sample.count({
        where: { buildingId, status: { in: ["collected", "submitted", "at_lab"] } },
      }),
      db.sample.count({
        where: { buildingId, status: { in: ["results_received", "reviewed"] } },
      }),
    ]);

  const reasons: string[] = [];
  let action = false;
  let attention = false;

  if (building.nextInspectionAt && building.nextInspectionAt < now) {
    reasons.push("Inspection overdue");
    action = true;
  } else if (building.nextInspectionAt && building.nextInspectionAt <= soon) {
    reasons.push("Inspection due within 30 days");
    attention = true;
  }
  if (damaged) {
    reasons.push(`${damaged} damaged ACM/PACM material${damaged > 1 ? "s" : ""}`);
    action = true;
  }
  if (overdueRepairs) {
    reasons.push(`${overdueRepairs} overdue repair${overdueRepairs > 1 ? "s" : ""}`);
    action = true;
  }
  if (awaiting) {
    reasons.push(`${awaiting} repair${awaiting > 1 ? "s" : ""} awaiting verification`);
    attention = true;
  }
  if (openRepairs) {
    reasons.push(`${openRepairs} open repair${openRepairs > 1 ? "s" : ""}`);
    attention = true;
  }
  if (pendingSamples) {
    reasons.push(`${pendingSamples} sample${pendingSamples > 1 ? "s" : ""} awaiting laboratory results`);
    attention = true;
  }
  if (unreconciled) {
    reasons.push(`${unreconciled} laboratory result${unreconciled > 1 ? "s" : ""} awaiting reconciliation`);
    attention = true;
  }

  const status = action ? "action" : attention ? "attention" : "current";
  if (!reasons.length) reasons.push("No identified outstanding actions");
  return { status, reasons };
}

export async function persistBuildingCompliance(buildingId: string) {
  const c = await evaluateBuilding(buildingId);
  await db.building.update({
    where: { id: buildingId },
    data: { complianceStatus: c.status, complianceReasons: JSON.stringify(c.reasons) },
  });
  return c;
}
