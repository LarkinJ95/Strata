"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertBuildingAccess, can, getSession } from "@/lib/auth";
import { activity, audit } from "@/lib/audit";
import { persistBuildingCompliance } from "@/lib/compliance";
import { putUpload } from "@/lib/storage";
import { requiresFieldSample } from "@/lib/inspection-rules";

async function actor() {
  const user = await getSession();
  if (!user) throw new Error("Sign in required");
  return user;
}

function nextCode(prefix: string, last?: string | null) {
  const n = last ? Number(last.split("-").pop()) + 1 : 1;
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

export async function startInspection(buildingId: string, type = "annual_inspection") {
  const user = await actor();
  const building = await db.building.findFirst({
    where: { id: buildingId, organizationId: user.organizationId },
  });
  if (!building) throw new Error("Building not found");
  if (!can(user, "inspections.perform")) throw new Error("Not allowed to create inspections");
  const existing = await db.inspection.findFirst({
    where: { buildingId, inspectionType: type, status: { in: ["draft", "in_progress", "submitted"] } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) throw new Error("An active inspection of this type already exists for this building. Open it instead of creating a duplicate.");

  const items = await db.inventoryItem.findMany({
    where: { buildingId, recordStatus: { in: ["active", "removed"] } },
  });

  const insp = await db.inspection.create({
    data: {
      organizationId: user.organizationId,
      clientId: building.clientId,
      buildingId,
      inspectionType: type,
      scheduledDate: new Date(),
      startedAt: new Date(),
      inspectorId: user.id,
      status: "in_progress",
      completionPct: 0,
    },
  });

  if (items.length) {
    await db.inspectionItem.createMany({
      data: items.map((it) => ({
        inspectionId: insp.id,
        inventoryItemId: it.id,
        previousCondition: it.condition,
        previousLabel: it.labelCondition,
        photoRequired: false,
      })),
    });
  }

  await activity({
    user,
    organizationId: user.organizationId,
    clientId: building.clientId,
    buildingId,
    inspectionId: insp.id,
    eventType: "inspection",
    title: "Inspection started",
    detail: type,
  });
  await audit({ user, action: "inspection.start", recordType: "inspection", recordId: insp.id });
  revalidatePath("/inspections");
  return insp.id;
}

export async function cancelInspection(inspectionId: string) {
  const user = await actor();
  if (!can(user, "inspections.approve")) throw new Error("Only an inspection approver can cancel an inspection");
  const inspection = await db.inspection.findFirst({ where: { id: inspectionId, organizationId: user.organizationId } });
  if (!inspection) throw new Error("Inspection not found");
  if (inspection.status === "completed") throw new Error("Completed inspections cannot be cancelled");
  await db.inspection.update({ where: { id: inspectionId }, data: { status: "cancelled", completedAt: new Date() } });
  await audit({ user, action: "inspection.cancel", recordType: "inspection", recordId: inspectionId, previousValue: inspection });
  revalidatePath("/inspections");
  revalidatePath(`/buildings/${inspection.buildingId}`);
  return { ok: true };
}

export async function saveInspectionItem(input: {
  itemId: string;
  currentCondition?: string;
  currentLabel?: string;
  notes?: string;
  quantityObserved?: number | null;
  materialRemoved?: boolean;
  removedQuantity?: number | null;
}) {
  const user = await actor();
  const existing = await db.inspectionItem.findUnique({ where: { id: input.itemId }, include: { inspection: { include: { building: true } }, inventoryItem: true } });
  if (!existing || existing.inspection.organizationId !== user.organizationId) throw new Error("Inspection item not found");
  // A removed material has nothing remaining to photograph. Keep the photo
  // requirement for conditions where the material is still present and its
  // condition needs visual evidence.
  const photoRequired = existing.inspection.building.photoPolicy !== "prohibited" && ["damaged", "significantly_damaged", "needs_repair"].includes(input.currentCondition || "");
  const photoSinceStart = photoRequired ? await db.photoLink.findFirst({ where: { inventoryItemId: existing.inventoryItemId, photo: { uploadedAt: { gte: existing.inspection.startedAt ?? existing.inspection.createdAt } } }, select: { id: true } }) : null;
  const sampleRequired = requiresFieldSample(existing.inventoryItem.acmClassification, input.currentCondition);
  const sampleSinceStart = sampleRequired ? await db.sampleInventoryLink.findFirst({ where: { inventoryItemId: existing.inventoryItemId, sample: { collectionDate: { gte: existing.inspection.startedAt ?? existing.inspection.createdAt } } }, select: { id: true } }) : null;
  const inspected = Boolean(input.currentCondition) && (!sampleRequired || Boolean(sampleSinceStart));
  const item = await db.inspectionItem.update({
    where: { id: input.itemId },
    data: {
      currentCondition: input.currentCondition,
      currentLabel: input.currentLabel,
      notes: input.notes,
      quantityObserved: input.quantityObserved ?? undefined,
      materialRemoved: input.materialRemoved ?? false,
      removedQuantity: input.removedQuantity ?? undefined,
      inspected,
      inspectedAt: inspected ? (existing.inspection.completedAt ?? existing.inspection.startedAt ?? new Date()) : null,
      photoRequired,
      photosSatisfied: photoRequired ? Boolean(photoSinceStart) : true,
    },
    include: { inspection: true },
  });
  const total = await db.inspectionItem.count({ where: { inspectionId: item.inspectionId } });
  const done = await db.inspectionItem.count({ where: { inspectionId: item.inspectionId, inspected: true } });
  const pct = total ? Math.round((done / total) * 100) : 0;
  await db.inspection.update({ where: { id: item.inspectionId }, data: { completionPct: pct } });
  await audit({
    user,
    action: "inspection.item.save",
    recordType: "inspection_item",
    recordId: item.id,
    newValue: input,
    relatedInspectionId: item.inspectionId,
  });
  revalidatePath(`/inspections/${item.inspectionId}`);
  return { pct };
}

export async function collectInspectionItemSample(itemId: string) {
  const user = await actor();
  if (!can(user, "samples.add")) throw new Error("Not allowed to collect samples");
  const item = await db.inspectionItem.findUnique({
    where: { id: itemId },
    include: { inspection: true, inventoryItem: true },
  });
  if (!item || item.inspection.organizationId !== user.organizationId) throw new Error("Inspection item not found");
  if (!requiresFieldSample(item.inventoryItem.acmClassification, item.currentCondition)) {
    throw new Error("A field sample is not required for this material and condition");
  }

  const collectedAfter = item.inspection.startedAt ?? item.inspection.createdAt;
  const existing = await db.sampleInventoryLink.findFirst({
    where: {
      inventoryItemId: item.inventoryItemId,
      sample: { collectionDate: { gte: collectedAfter } },
    },
    include: { sample: true },
  });
  if (existing) return { id: existing.sample.id, sampleNumber: existing.sample.sampleNumber };

  const prefix = String(new Date().getFullYear()).slice(-2);
  const last = await db.sample.findFirst({
    where: { organizationId: user.organizationId, sampleNumber: { startsWith: `${prefix}-` } },
    orderBy: { sampleNumber: "desc" },
  });
  const sampleNumber = nextCode(prefix, last?.sampleNumber);
  const inventory = item.inventoryItem;
  const sample = await db.sample.create({
    data: {
      organizationId: user.organizationId,
      clientId: inventory.clientId,
      buildingId: inventory.buildingId,
      homogeneousAreaId: inventory.homogeneousAreaId,
      sampleNumber,
      floor: inventory.floor,
      room: inventory.room,
      location: inventory.specificLocation,
      material: inventory.materialDescription,
      materialDescription: inventory.materialDescription,
      notes: `Required field sample collected during inspection ${item.inspectionId}`,
      collectionDate: new Date(),
      inspectorId: user.id,
      status: "collected",
    },
  });
  await db.sampleLayer.create({ data: { sampleId: sample.id, layerNumber: 1, description: inventory.materialDescription } });
  await db.sampleInventoryLink.create({ data: { sampleId: sample.id, inventoryItemId: inventory.id, layerNumber: 1, linkType: "supporting" } });
  if (item.currentCondition) await db.inspectionItem.update({ where: { id: item.id }, data: { inspected: true, inspectedAt: new Date() } });
  const total = await db.inspectionItem.count({ where: { inspectionId: item.inspectionId } });
  const done = await db.inspectionItem.count({ where: { inspectionId: item.inspectionId, inspected: true } });
  await db.inspection.update({ where: { id: item.inspectionId }, data: { completionPct: total ? Math.round((done / total) * 100) : 0 } });
  await activity({
    user,
    organizationId: user.organizationId,
    clientId: inventory.clientId,
    buildingId: inventory.buildingId,
    inspectionId: item.inspectionId,
    sampleId: sample.id,
    eventType: "sample",
    title: `Sample ${sampleNumber} collected`,
    detail: `${inventory.inventoryCode} · required by field condition`,
  });
  await audit({
    user,
    action: "inspection.sample.collect",
    recordType: "sample",
    recordId: sample.id,
    newValue: { inspectionItemId: item.id, inventoryItemId: inventory.id, sampleNumber },
    relatedInspectionId: item.inspectionId,
  });
  revalidatePath(`/inspections/${item.inspectionId}/field`);
  revalidatePath(`/inspections/${item.inspectionId}`);
  revalidatePath(`/buildings/${inventory.buildingId}`);
  revalidatePath("/samples");
  return { id: sample.id, sampleNumber };
}

export async function submitInspection(inspectionId: string, signatureName: string, notes?: string) {
  const user = await actor();
  const insp = await db.inspection.findFirst({
    where: { id: inspectionId, organizationId: user.organizationId },
    include: { items: true, building: true },
  });
  if (!insp) throw new Error("Inspection not found");
  const performedAt = insp.completedAt ?? new Date();
  const blockers = insp.items.filter((item) => item.photoRequired && !item.photosSatisfied && insp.building.photoPolicy !== "prohibited");
  if (blockers.length) throw new Error(`${blockers.length} inspection item(s) require a photograph before submission`);
  const sampleBlockers = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT ii."id"
    FROM "InspectionItem" ii
    INNER JOIN "InventoryItem" inv ON inv."id" = ii."inventoryItemId"
    WHERE ii."inspectionId" = ${inspectionId}
      AND ii."currentCondition" IN ('damaged', 'significantly_damaged', 'needs_repair')
      AND inv."acmClassification" IN ('assumed_acm', 'pacm')
      AND NOT EXISTS (
        SELECT 1
        FROM "SampleInventoryLink" sampleLink
        INNER JOIN "Sample" sample ON sample."id" = sampleLink."sampleId"
        WHERE sampleLink."inventoryItemId" = inv."id"
          AND sample."collectionDate" >= ${insp.startedAt ?? insp.createdAt}
      )
  `);
  if (sampleBlockers.length) throw new Error(`${sampleBlockers.length} assumed/PACM inspection item(s) require a field sample before submission`);

  for (const item of insp.items) {
    if (!item.inspected || !item.currentCondition) continue;
    const inv = await db.inventoryItem.findUnique({ where: { id: item.inventoryItemId } });
    if (!inv) continue;
    if (item.currentCondition !== inv.condition) {
      await db.inventoryConditionHistory.create({
        data: {
          inventoryItemId: inv.id,
          previousCondition: inv.condition,
          newCondition: item.currentCondition,
          inspectionId,
          inspectorId: user.id,
          notes: item.notes,
          changedAt: performedAt,
        },
      });
    }
    if (item.currentLabel && item.currentLabel !== inv.labelCondition) {
      await db.inventoryLabelHistory.create({
        data: {
          inventoryItemId: inv.id,
          labelPresent: item.currentLabel !== "missing",
          labelCondition: item.currentLabel,
          labelReplaced: item.currentLabel === "replaced",
          labelMissing: item.currentLabel === "missing",
          inspectionId,
          changedById: user.id,
          changedAt: performedAt,
        },
      });
    }
    const newerExists = await db.inspectionItem.findFirst({ where: { inventoryItemId: inv.id, inspected: true, inspectionId: { not: inspectionId }, inspection: { status: "completed", completedAt: { gt: performedAt } } }, select: { id: true } });
    if (!newerExists) await db.inventoryItem.update({ where: { id: inv.id }, data: { condition: item.currentCondition, labelCondition: item.currentLabel ?? inv.labelCondition, labelPresent: item.currentLabel ? item.currentLabel !== "missing" : inv.labelPresent, recordStatus: item.currentCondition === "removed" ? "removed" : inv.recordStatus } });
  }

  await db.inspection.update({
    where: { id: inspectionId },
    data: {
      status: "completed",
      completedAt: performedAt,
      signedAt: performedAt,
      notes: notes ?? insp.notes,
      completionPct: 100,
    },
  });
  await db.signature.create({
    data: {
      organizationId: user.organizationId,
      inspectionId,
      userId: user.id,
      signerName: signatureName || user.name,
      signerRole: user.roleName,
      signatureData: signatureName || user.name,
      meaning: "Inspection completion",
      signedAt: performedAt,
    },
  });
  if (!insp.building.lastInspectionAt || performedAt > insp.building.lastInspectionAt) await db.building.update({ where: { id: insp.buildingId }, data: { lastInspectionAt: performedAt, nextInspectionAt: new Date(performedAt.getTime() + (insp.building.inspectionIntervalDays || 365) * 86400000) } });
  await persistBuildingCompliance(insp.buildingId);
  await activity({
    user,
    organizationId: user.organizationId,
    clientId: insp.clientId,
    buildingId: insp.buildingId,
    inspectionId,
    eventType: "inspection",
    title: "Inspection completed",
    detail: signatureName,
  });
  revalidatePath("/inspections");
  revalidatePath(`/buildings/${insp.buildingId}`);
  return { ok: true };
}

export async function saveHistoricalInspection(input: { buildingId: string; inspectionType: string; performedAt: Date; inspectorName: string; findings?: string; notes?: string; status: "draft" | "completed"; items: { inventoryItemId: string; currentCondition?: string; currentLabel?: string; quantityObserved?: number; materialRemoved?: boolean; removedQuantity?: number; notes?: string }[] }) {
  const user = await actor();
  if (!can(user, "inspections.perform")) throw new Error("Not allowed to record inspections");
  if (input.performedAt > new Date()) throw new Error("Historical inspection dates cannot be in the future");
  const building = await db.building.findFirst({ where: { id: input.buildingId, organizationId: user.organizationId } });
  if (!building) throw new Error("Building not found");
  const existing = await db.inspection.findFirst({
    where: {
      buildingId: building.id,
      inspectionType: input.inspectionType,
      scheduledDate: input.performedAt,
      status: { in: ["draft", "in_progress", "submitted", "completed"] },
    },
    select: { id: true },
  });
  if (existing) return { id: existing.id, applied: 0, historyOnly: 0, alreadyRecorded: true };
  const filled = input.items.filter((item) => item.currentCondition || item.currentLabel || item.quantityObserved != null || item.materialRemoved || item.notes);
  const inspection = await db.inspection.create({ data: { organizationId: user.organizationId, clientId: building.clientId, buildingId: building.id, inspectionType: input.inspectionType, scheduledDate: input.performedAt, startedAt: input.performedAt, completedAt: input.status === "completed" ? input.performedAt : null, signedAt: input.status === "completed" ? input.performedAt : null, inspectorId: user.id, status: input.status, completionPct: filled.length ? 100 : 0, findings: input.findings, notes: input.notes } });
  let applied = 0;
  for (const entry of filled) {
    const inv = await db.inventoryItem.findFirst({ where: { id: entry.inventoryItemId, buildingId: building.id } });
    if (!inv) continue;
    const [previousCondition, previousLabel] = await Promise.all([
      db.inventoryConditionHistory.findFirst({ where: { inventoryItemId: inv.id, changedAt: { lte: input.performedAt } }, orderBy: { changedAt: "desc" } }),
      db.inventoryLabelHistory.findFirst({ where: { inventoryItemId: inv.id, changedAt: { lte: input.performedAt } }, orderBy: { changedAt: "desc" } }),
    ]);
    await db.inspectionItem.create({ data: { inspectionId: inspection.id, inventoryItemId: inv.id, previousCondition: previousCondition?.newCondition, currentCondition: entry.currentCondition, previousLabel: previousLabel?.labelCondition, currentLabel: entry.currentLabel, quantityObserved: entry.quantityObserved, materialRemoved: entry.materialRemoved ?? false, removedQuantity: entry.removedQuantity, notes: entry.notes, inspected: true, inspectedAt: input.performedAt } });
    if (entry.currentCondition) await db.inventoryConditionHistory.create({ data: { inventoryItemId: inv.id, previousCondition: previousCondition?.newCondition, newCondition: entry.currentCondition, inspectionId: inspection.id, inspectorId: user.id, notes: entry.notes, changedAt: input.performedAt } });
    if (entry.currentLabel) await db.inventoryLabelHistory.create({ data: { inventoryItemId: inv.id, labelPresent: entry.currentLabel !== "missing", labelCondition: entry.currentLabel, labelReplaced: entry.currentLabel === "replaced", labelMissing: entry.currentLabel === "missing", unableToReplace: entry.currentLabel === "unable_to_replace", inspectionId: inspection.id, changedById: user.id, notes: entry.notes, changedAt: input.performedAt } });
    if (entry.currentCondition || entry.currentLabel) {
      const newer = await db.inspectionItem.findFirst({ where: { inventoryItemId: inv.id, inspected: true, inspection: { status: "completed", completedAt: { gt: input.performedAt } } } });
      if (!newer && input.status === "completed") {
        await db.inventoryItem.update({ where: { id: inv.id }, data: { condition: entry.currentCondition ?? inv.condition, labelCondition: entry.currentLabel ?? inv.labelCondition, labelPresent: entry.currentLabel ? entry.currentLabel !== "missing" : inv.labelPresent, recordStatus: entry.currentCondition === "removed" ? "removed" : inv.recordStatus } });
        applied++;
      }
    }
  }
  if (input.status === "completed" && (!building.lastInspectionAt || input.performedAt > building.lastInspectionAt)) await db.building.update({ where: { id: building.id }, data: { lastInspectionAt: input.performedAt, nextInspectionAt: new Date(input.performedAt.getTime() + building.inspectionIntervalDays * 86400000) } });
  if (input.status === "completed") await db.signature.create({ data: { organizationId: user.organizationId, inspectionId: inspection.id, userId: user.id, signerName: input.inspectorName, signatureData: input.inspectorName, meaning: "Historical entry", signedAt: input.performedAt } });
  await activity({ user, organizationId: user.organizationId, clientId: building.clientId, buildingId: building.id, inspectionId: inspection.id, eventType: "inspection", title: "Historical inspection recorded", detail: input.performedAt.toISOString().slice(0, 10) });
  await audit({ user, action: "inspection.backfill", recordType: "inspection", recordId: inspection.id, newValue: input });
  revalidatePath("/inspections"); revalidatePath(`/buildings/${building.id}`); return { id: inspection.id, applied, historyOnly: filled.length - applied };
}

export async function createSample(input: {
  buildingId: string;
  floor?: string;
  room?: string;
  location?: string;
  material: string;
  materialDescription?: string;
  notes?: string;
}) {
  const user = await actor();
  const building = await db.building.findFirst({
    where: { id: input.buildingId, organizationId: user.organizationId },
  });
  if (!building) throw new Error("Building not found");
  const last = await db.sample.findFirst({
    where: { organizationId: user.organizationId, sampleNumber: { startsWith: "26-" } },
    orderBy: { sampleNumber: "desc" },
  });
  const sampleNumber = nextCode("26", last?.sampleNumber);
  const sample = await db.sample.create({
    data: {
      organizationId: user.organizationId,
      clientId: building.clientId,
      buildingId: building.id,
      sampleNumber,
      floor: input.floor,
      room: input.room,
      location: input.location,
      material: input.material,
      materialDescription: input.materialDescription,
      notes: input.notes,
      collectionDate: new Date(),
      inspectorId: user.id,
      status: "collected",
    },
  });
  await db.sampleLayer.create({
    data: { sampleId: sample.id, layerNumber: 1, description: input.material },
  });
  await activity({
    user,
    organizationId: user.organizationId,
    clientId: building.clientId,
    buildingId: building.id,
    sampleId: sample.id,
    eventType: "sample",
    title: `Sample ${sampleNumber} collected`,
    detail: input.material,
  });
  revalidatePath("/samples");
  return sample.id;
}

export async function enterSampleResult(input: {
  sampleId: string;
  layerNumber: number;
  asbestosDetected: boolean;
  asbestosPercent?: number;
  detectionLimit?: string;
  fiberTypes: string[];
  method: string;
  comments?: string;
}) {
  const user = await actor();
  const sample = await db.sample.findFirst({
    where: { id: input.sampleId, organizationId: user.organizationId },
    include: { layers: true },
  });
  if (!sample) throw new Error("Sample not found");
  let layer = sample.layers.find((l) => l.layerNumber === input.layerNumber);
  if (!layer) {
    layer = await db.sampleLayer.create({
      data: {
        sampleId: sample.id,
        layerNumber: input.layerNumber,
        description: `Layer ${input.layerNumber}`,
      },
    });
  }
  await db.sampleLayer.update({
    where: { id: layer.id },
    data: {
      asbestosDetected: input.asbestosDetected,
      asbestosPercent: input.asbestosPercent,
      fiberTypes: JSON.stringify(input.fiberTypes),
      classification: input.asbestosDetected ? "confirmed_acm" : "non_acm",
      comments: input.comments,
      detectionLimit: input.detectionLimit,
    },
  });
  await db.sampleResult.upsert({
    where: { sampleLayerId: layer.id },
    create: {
      sampleLayerId: layer.id,
      asbestosDetected: input.asbestosDetected,
      asbestosPercent: input.asbestosPercent,
      fiberTypes: JSON.stringify(input.fiberTypes),
      method: input.method,
      detectionLimit: input.detectionLimit,
      labComments: input.comments,
    },
    update: {
      asbestosDetected: input.asbestosDetected,
      asbestosPercent: input.asbestosPercent,
      fiberTypes: JSON.stringify(input.fiberTypes),
      method: input.method,
      detectionLimit: input.detectionLimit,
      labComments: input.comments,
    },
  });
  await db.sample.update({
    where: { id: sample.id },
    data: { status: "results_received", dateResultsReceived: new Date(), analysisMethod: input.method },
  });
  revalidatePath("/samples");
  return { ok: true };
}

export async function reconcileSample(input: {
  sampleId: string;
  action: "create" | "link" | "update" | "supporting" | "none";
  inventoryItemId?: string;
  explanation?: string;
  newItem?: {
    floor?: string;
    room?: string;
    location?: string;
    material: string;
    classification: string;
    quantity?: number;
    unit?: string;
    condition?: string;
  };
}) {
  const user = await actor();
  const sample = await db.sample.findFirst({
    where: { id: input.sampleId, organizationId: user.organizationId },
    include: { layers: { include: { result: true } }, building: true },
  });
  if (!sample) throw new Error("Sample not found");

  if (input.action === "none") {
    await db.sample.update({
      where: { id: sample.id },
      data: { status: "no_entry", notes: `${sample.notes ?? ""}\nNo inventory entry: ${input.explanation ?? ""}`.trim() },
    });
  } else if (input.action === "create" && input.newItem) {
    const last = await db.inventoryItem.findFirst({
      where: { buildingId: sample.buildingId },
      orderBy: { inventoryCode: "desc" },
    });
    const code = nextCode("", last?.inventoryCode).replace(/^-/, "");
    const layer = sample.layers[0];
    const item = await db.inventoryItem.create({
      data: {
        organizationId: user.organizationId,
        clientId: sample.clientId,
        facilityId: sample.building.facilityId,
        buildingId: sample.buildingId,
        inventoryCode: code,
        internalCode: `${sample.building.buildingNumber}-${code}`,
        floor: input.newItem.floor ?? sample.floor,
        room: input.newItem.room ?? sample.room,
        specificLocation: input.newItem.location ?? sample.location,
        materialCategory: "Miscellaneous",
        materialDescription: input.newItem.material,
        acmClassification: input.newItem.classification,
        asbestosDetected: layer?.result?.asbestosDetected ?? null,
        asbestosPercent: layer?.result?.asbestosPercent ?? null,
        fiberTypes: layer?.result?.fiberTypes ?? "[]",
        analyticalMethod: sample.analysisMethod,
        originalQuantity: input.newItem.quantity ?? 0,
        currentQuantity: input.newItem.quantity ?? 0,
        quantityUnit: input.newItem.unit ?? "SF",
        condition: input.newItem.condition ?? "good",
        isProvisional: false,
      },
    });
    await db.inventoryQuantityHistory.create({
      data: {
        inventoryItemId: item.id,
        newQty: input.newItem.quantity ?? 0,
        unit: input.newItem.unit ?? "SF",
        reason: `Created from sample ${sample.sampleNumber}`,
        sourceType: "sample",
        sourceId: sample.id,
        changedById: user.id,
      },
    });
    await db.sampleInventoryLink.create({
      data: { sampleId: sample.id, inventoryItemId: item.id, layerNumber: 1, linkType: "supporting" },
    });
    await db.sample.update({ where: { id: sample.id }, data: { status: "reconciled" } });
  } else if ((input.action === "link" || input.action === "update" || input.action === "supporting") && input.inventoryItemId) {
    await db.sampleInventoryLink.create({
      data: {
        sampleId: sample.id,
        inventoryItemId: input.inventoryItemId,
        layerNumber: 1,
        linkType: input.action === "supporting" ? "supporting" : input.action,
      },
    });
    if (input.action === "update") {
      const layer = sample.layers[0];
      await db.inventoryItem.update({
        where: { id: input.inventoryItemId },
        data: {
          asbestosDetected: layer?.result?.asbestosDetected ?? undefined,
          asbestosPercent: layer?.result?.asbestosPercent ?? undefined,
          fiberTypes: layer?.result?.fiberTypes ?? undefined,
          acmClassification: layer?.result?.asbestosDetected ? "confirmed_acm" : "non_acm",
          analyticalMethod: sample.analysisMethod,
          isProvisional: false,
        },
      });
    }
    await db.sample.update({ where: { id: sample.id }, data: { status: "reconciled" } });
  }

  await persistBuildingCompliance(sample.buildingId);
  await activity({
    user,
    organizationId: user.organizationId,
    clientId: sample.clientId,
    buildingId: sample.buildingId,
    sampleId: sample.id,
    eventType: "sample",
    title: `Sample ${sample.sampleNumber} reconciled`,
    detail: input.action,
  });
  revalidatePath("/samples");
  return { ok: true };
}

export async function createRepair(input: {
  inventoryItemId: string;
  problem: string;
  priority: string;
  recommendedResponse?: string;
  estimatedCost?: number;
  scheduledDate?: string;
}) {
  const user = await actor();
  const inv = await db.inventoryItem.findFirst({
    where: { id: input.inventoryItemId, organizationId: user.organizationId },
    include: { building: true },
  });
  if (!inv) throw new Error("Inventory not found");
  const last = await db.repair.findFirst({
    where: { organizationId: user.organizationId },
    orderBy: { repairCode: "desc" },
  });
  const repairCode = nextCode("R-26", last?.repairCode?.startsWith("R-26") ? last.repairCode : "R-26-000");
  const repair = await db.repair.create({
    data: {
      organizationId: user.organizationId,
      clientId: inv.clientId,
      buildingId: inv.buildingId,
      inventoryItemId: inv.id,
      repairCode,
      problem: input.problem,
      condition: inv.condition,
      inspectorId: user.id,
      priority: input.priority,
      recommendedResponse: input.recommendedResponse,
      estimatedCost: input.estimatedCost,
      scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : null,
      status: "open",
    },
  });
  await persistBuildingCompliance(inv.buildingId);
  await activity({
    user,
    organizationId: user.organizationId,
    clientId: inv.clientId,
    buildingId: inv.buildingId,
    inventoryItemId: inv.id,
    repairId: repair.id,
    eventType: "repair",
    title: `Repair ${repairCode} opened`,
    detail: input.problem,
  });
  revalidatePath("/repairs");
  return repair.id;
}

export async function updateRepairStatus(id: string, status: string, completionNotes?: string) {
  const user = await actor();
  const repair = await db.repair.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!repair) throw new Error("Repair not found");
  await db.repair.update({
    where: { id },
    data: {
      status,
      completionNotes,
      completionDate: ["awaiting_verification", "completed", "closed"].includes(status) ? new Date() : repair.completionDate,
    },
  });
  await persistBuildingCompliance(repair.buildingId);
  revalidatePath(`/repairs/${id}`);
  return { ok: true };
}

export async function verifyRepair(input: {
  repairId: string;
  satisfactory: boolean;
  updatedCondition?: string;
  updatedQuantity?: number;
  labelStatus?: string;
  notes?: string;
  followUpRequired?: boolean;
}) {
  const user = await actor();
  const repair = await db.repair.findFirst({
    where: { id: input.repairId, organizationId: user.organizationId },
  });
  if (!repair) throw new Error("Repair not found");
  await db.repairVerification.upsert({
    where: { repairId: repair.id },
    create: {
      repairId: repair.id,
      inspectorId: user.id,
      satisfactory: input.satisfactory,
      updatedCondition: input.updatedCondition,
      updatedQuantity: input.updatedQuantity,
      labelStatus: input.labelStatus,
      notes: input.notes,
      followUpRequired: input.followUpRequired ?? false,
    },
    update: {
      inspectorId: user.id,
      satisfactory: input.satisfactory,
      updatedCondition: input.updatedCondition,
      updatedQuantity: input.updatedQuantity,
      labelStatus: input.labelStatus,
      notes: input.notes,
      followUpRequired: input.followUpRequired ?? false,
    },
  });
  if (input.satisfactory) {
    const inv = await db.inventoryItem.findUnique({ where: { id: repair.inventoryItemId } });
    if (inv && input.updatedCondition) {
      await db.inventoryConditionHistory.create({
        data: {
          inventoryItemId: inv.id,
          previousCondition: inv.condition,
          newCondition: input.updatedCondition,
          inspectorId: user.id,
          notes: `Verified repair ${repair.repairCode}`,
        },
      });
      await db.inventoryItem.update({
        where: { id: inv.id },
        data: { condition: input.updatedCondition, labelCondition: input.labelStatus ?? inv.labelCondition },
      });
    }
    await db.repair.update({ where: { id: repair.id }, data: { status: "closed" } });
  } else {
    await db.repair.update({ where: { id: repair.id }, data: { status: "open" } });
  }
  await persistBuildingCompliance(repair.buildingId);
  await activity({
    user,
    organizationId: user.organizationId,
    clientId: repair.clientId,
    buildingId: repair.buildingId,
    inventoryItemId: repair.inventoryItemId,
    repairId: repair.id,
    eventType: "repair",
    title: `Repair ${repair.repairCode} ${input.satisfactory ? "verified" : "returned"}`,
    detail: input.notes,
  });
  revalidatePath(`/repairs/${repair.id}`);
  return { ok: true };
}

export async function recordRemoval(input: {
  inventoryItemId: string;
  quantityRemoved: number;
  contractorId?: string;
  projectNumber?: string;
  workOrder?: string;
  notificationNumber?: string;
  wasteShipment?: string;
  disposalFacility?: string;
  notes?: string;
}) {
  const user = await actor();
  const inv = await db.inventoryItem.findFirst({
    where: { id: input.inventoryItemId, organizationId: user.organizationId },
  });
  if (!inv) throw new Error("Inventory not found");
  const before = inv.currentQuantity ?? 0;
  const remaining = Math.max(0, before - input.quantityRemoved);
  await db.removalEvent.create({
    data: {
      organizationId: user.organizationId,
      buildingId: inv.buildingId,
      inventoryItemId: inv.id,
      quantityBefore: before,
      quantityRemoved: input.quantityRemoved,
      quantityRemaining: remaining,
      unit: inv.quantityUnit,
      removedAt: new Date(),
      contractorId: input.contractorId,
      projectNumber: input.projectNumber,
      workOrder: input.workOrder,
      notificationNumber: input.notificationNumber,
      wasteShipment: input.wasteShipment,
      disposalFacility: input.disposalFacility,
      notes: input.notes,
    },
  });
  await db.inventoryQuantityHistory.create({
    data: {
      inventoryItemId: inv.id,
      previousQty: before,
      newQty: remaining,
      delta: -input.quantityRemoved,
      unit: inv.quantityUnit,
      reason: "Removal / abatement",
      sourceType: "removal",
      changedById: user.id,
    },
  });
  await db.inventoryItem.update({
    where: { id: inv.id },
    data: {
      currentQuantity: remaining,
      quantityRemoved: (inv.quantityRemoved ?? 0) + input.quantityRemoved,
      recordStatus: remaining === 0 ? "removed" : inv.recordStatus,
      condition: remaining === 0 ? "removed" : inv.condition,
      acmClassification: remaining === 0 ? "removed" : inv.acmClassification,
    },
  });
  await persistBuildingCompliance(inv.buildingId);
  await activity({
    user,
    organizationId: user.organizationId,
    clientId: inv.clientId,
    buildingId: inv.buildingId,
    inventoryItemId: inv.id,
    eventType: "removal",
    title: `${input.quantityRemoved} ${inv.quantityUnit} removed from ${inv.inventoryCode}`,
    detail: input.notes,
  });
  revalidatePath(`/inventory/${inv.id}`);
  return { ok: true };
}

export async function updateInventoryField(id: string, patch: Record<string, unknown>) {
  const user = await actor();
  const inv = await db.inventoryItem.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!inv) throw new Error("Not found");
  const allowed = [
    "condition",
    "labelCondition",
    "labelPresent",
    "responseAction",
    "notes",
    "accessibility",
    "disturbancePotential",
    "currentQuantity",
  ];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in patch) data[k] = patch[k];
  if ("currentQuantity" in data && data.currentQuantity !== inv.currentQuantity) {
    await db.inventoryQuantityHistory.create({
      data: {
        inventoryItemId: id,
        previousQty: inv.currentQuantity,
        newQty: Number(data.currentQuantity),
        delta: Number(data.currentQuantity) - (inv.currentQuantity ?? 0),
        unit: inv.quantityUnit,
        reason: "Manual quantity adjustment",
        changedById: user.id,
      },
    });
  }
  if ("condition" in data && data.condition !== inv.condition) {
    await db.inventoryConditionHistory.create({
      data: {
        inventoryItemId: id,
        previousCondition: inv.condition,
        newCondition: String(data.condition),
        inspectorId: user.id,
      },
    });
  }
  await db.inventoryItem.update({ where: { id }, data });
  await audit({ user, action: "inventory.update", recordType: "inventory", recordId: id, previousValue: inv, newValue: data });
  revalidatePath(`/inventory/${id}`);
  return { ok: true };
}

export async function createSuspectMaterial(input: {
  buildingId: string;
  inspectionId?: string;
  floor?: string;
  room?: string;
  location?: string;
  material: string;
  estimatedQty?: number;
  unit?: string;
  condition?: string;
  friability?: string;
  action?: string;
  notes?: string;
}) {
  const user = await actor();
  const building = await db.building.findFirst({
    where: { id: input.buildingId, organizationId: user.organizationId },
  });
  if (!building) throw new Error("Building not found");
  const last = await db.inventoryItem.findFirst({
    where: { buildingId: building.id },
    orderBy: { inventoryCode: "desc" },
  });
  const code = nextCode("", last?.inventoryCode).replace(/^-/, "");
  const item = await db.inventoryItem.create({
    data: {
      organizationId: user.organizationId,
      clientId: building.clientId,
      facilityId: building.facilityId,
      buildingId: building.id,
      inventoryCode: code,
      internalCode: `${building.buildingNumber}-${code}`,
      floor: input.floor,
      room: input.room,
      specificLocation: input.location,
      materialCategory: "Miscellaneous",
      materialDescription: input.material,
      acmClassification: input.action === "Assume ACM" ? "assumed_acm" : "unknown",
      originalQuantity: input.estimatedQty,
      currentQuantity: input.estimatedQty,
      quantityUnit: input.unit ?? "SF",
      condition: input.condition ?? "fair",
      friable: input.friability,
      isProvisional: true,
      notes: input.notes,
      responseAction: input.action === "Assume ACM" ? "Continue surveillance" : "Further sampling",
    },
  });
  await db.suspectMaterial.create({
    data: {
      inspectionId: input.inspectionId,
      buildingId: building.id,
      inventoryItemId: item.id,
      floor: input.floor,
      room: input.room,
      location: input.location,
      material: input.material,
      estimatedQty: input.estimatedQty,
      unit: input.unit,
      condition: input.condition,
      friability: input.friability,
      action: input.action,
      notes: input.notes,
    },
  });
  revalidatePath(`/buildings/${building.id}`);
  return item.id;
}

export async function uploadPhoto(formData: FormData) {
  const user = await actor();
  if (!can(user, "photos.add")) throw new Error("Not allowed to upload photographs");
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No file");
  const buildingId = String(formData.get("buildingId") || "");
  const recordType = String(formData.get("recordType") || "inventory");
  const recordId = String(formData.get("recordId") || "");
  const category = String(formData.get("category") || "material");
  const caption = String(formData.get("caption") || "");
  const visibility = String(formData.get("visibility") || "internal");

  const building = buildingId
    ? await db.building.findFirst({ where: { id: buildingId, organizationId: user.organizationId } })
    : null;
  if (!building || !assertBuildingAccess(user, building)) throw new Error("Building not found");

  const storageKey = await putUpload({ organizationId: user.organizationId, category: "photos", file });

  const photo = await db.photo.create({
    data: {
      organizationId: user.organizationId,
      clientId: building?.clientId,
      buildingId: building?.id,
      storageKey,
      originalFilename: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      capturedAt: new Date(),
      uploadedById: user.id,
      photographerId: user.id,
      visibility,
    },
  });

  await db.photoLink.create({
    data: {
      photoId: photo.id,
      recordType,
      recordId,
      category,
      caption,
      inventoryItemId: recordType === "inventory" ? recordId : undefined,
      inspectionId: recordType === "inspection" ? recordId : undefined,
      repairId: recordType === "repair" ? recordId : undefined,
      sampleId: recordType === "sample" ? recordId : undefined,
      removalId: recordType === "removal" ? recordId : undefined,
    },
  });
  revalidatePath("/");
  revalidatePath(`/buildings/${building.id}`);
  return { id: photo.id, storageKey };
}

export async function uploadBuildingDocument(formData: FormData) {
  const user = await actor();
  if (!can(user, "documents.upload")) throw new Error("Not allowed to upload documents");
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) throw new Error("Choose a file to upload");

  const buildingId = String(formData.get("buildingId") || "");
  const building = await db.building.findFirst({ where: { id: buildingId, organizationId: user.organizationId } });
  if (!building || !assertBuildingAccess(user, building)) throw new Error("Building not found");

  const dateValue = String(formData.get("documentDate") || "");
  const documentDate = dateValue ? new Date(`${dateValue}T00:00:00.000Z`) : null;
  if (documentDate && Number.isNaN(documentDate.getTime())) throw new Error("Invalid document date");

  const storageKey = await putUpload({ organizationId: user.organizationId, category: "documents", file });
  const document = await db.document.create({
    data: {
      organizationId: user.organizationId,
      clientId: building.clientId,
      buildingId: building.id,
      name: String(formData.get("name") || file.name).trim() || file.name,
      docType: String(formData.get("docType") || "other"),
      storageKey,
      originalFilename: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      documentDate,
      description: String(formData.get("description") || "").trim() || null,
      visibility: "internal",
      uploadedById: user.id,
    },
  });
  await activity({
    user,
    organizationId: user.organizationId,
    clientId: building.clientId,
    buildingId: building.id,
    eventType: "document",
    title: "Document uploaded",
    detail: document.name,
  });
  await audit({ user, action: "document.upload", recordType: "document", recordId: document.id });
  revalidatePath("/");
  revalidatePath(`/buildings/${building.id}`);
  return { id: document.id, storageKey };
}

export async function markNotificationsRead() {
  const user = await actor();
  await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  revalidatePath("/");
}

export async function globalSearch(q: string) {
  const user = await actor();
  const term = q.trim();
  if (term.length < 2) return { clients: [], facilities: [], buildings: [], inventory: [], samples: [], repairs: [], documents: [] };
  const org = { organizationId: user.organizationId };
  const client = user.clientId ? { clientId: user.clientId } : {};
  const [clients, facilities, buildings, inventory, samples, repairs, documents] = await Promise.all([
    db.client.findMany({
      where: { ...org, ...(user.clientId ? { id: user.clientId } : {}), OR: [{ name: { contains: term } }, { clientNumber: { contains: term } }, { city: { contains: term } }] },
      take: 8,
    }),
    db.facility.findMany({
      where: { ...org, ...client, OR: [{ name: { contains: term } }, { facilityId: { contains: term } }, { city: { contains: term } }, { address: { contains: term } }] },
      include: { client: true },
      take: 8,
    }),
    db.building.findMany({
      where: { ...org, ...client, OR: [{ name: { contains: term } }, { buildingNumber: { contains: term } }] },
      take: 8,
    }),
    db.inventoryItem.findMany({
      where: {
        ...org,
        ...client,
        OR: [
          { inventoryCode: { contains: term } },
          { materialDescription: { contains: term } },
          { room: { contains: term } },
          { specificLocation: { contains: term } },
        ],
      },
      include: { building: true },
      take: 12,
    }),
    db.sample.findMany({
      where: {
        ...org,
        ...client,
        OR: [{ sampleNumber: { contains: term } }, { labSampleNumber: { contains: term } }, { material: { contains: term } }],
      },
      include: { building: true },
      take: 8,
    }),
    db.repair.findMany({
      where: {
        ...org,
        ...client,
        OR: [{ repairCode: { contains: term } }, { workOrderNumber: { contains: term } }, { problem: { contains: term } }],
      },
      include: { building: true },
      take: 8,
    }),
    db.document.findMany({
      where: { ...org, ...client, OR: [{ name: { contains: term } }, { docType: { contains: term } }] },
      take: 8,
    }),
  ]);
  return { clients, facilities, buildings, inventory, samples, repairs, documents };
}
