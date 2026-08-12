import { db } from "./db";
import type { SessionUser } from "./auth";

export async function audit(opts: {
  user?: SessionUser | null;
  action: string;
  recordType: string;
  recordId: string;
  previousValue?: unknown;
  newValue?: unknown;
  relatedInspectionId?: string;
}) {
  if (!opts.user) return;
  await db.auditEvent.create({
    data: {
      organizationId: opts.user.organizationId,
      userId: opts.user.id,
      action: opts.action,
      recordType: opts.recordType,
      recordId: opts.recordId,
      previousValue: opts.previousValue ? JSON.stringify(opts.previousValue) : null,
      newValue: opts.newValue ? JSON.stringify(opts.newValue) : null,
      relatedInspectionId: opts.relatedInspectionId,
    },
  });
}

export async function activity(opts: {
  user?: SessionUser | null;
  organizationId: string;
  clientId?: string | null;
  buildingId?: string | null;
  inventoryItemId?: string | null;
  sampleId?: string | null;
  inspectionId?: string | null;
  repairId?: string | null;
  removalId?: string | null;
  eventType: string;
  title: string;
  detail?: string;
}) {
  await db.activityEvent.create({
    data: {
      organizationId: opts.organizationId,
      clientId: opts.clientId ?? undefined,
      buildingId: opts.buildingId ?? undefined,
      inventoryItemId: opts.inventoryItemId ?? undefined,
      sampleId: opts.sampleId ?? undefined,
      inspectionId: opts.inspectionId ?? undefined,
      repairId: opts.repairId ?? undefined,
      removalId: opts.removalId ?? undefined,
      actorId: opts.user?.id,
      eventType: opts.eventType,
      title: opts.title,
      detail: opts.detail,
    },
  });
}
