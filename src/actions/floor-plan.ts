"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertBuildingAccess, can, getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { putUpload } from "@/lib/storage";
import { activity, audit } from "@/lib/audit";

export async function uploadFloorPlan(formData: FormData) {
  const user = await getSession();
  if (!user) throw new Error("Sign in required");
  if (!can(user, "documents.upload")) throw new Error("Not allowed to upload floor plans");
  const buildingId = String(formData.get("buildingId") || "");
  const name = String(formData.get("name") || "").trim();
  const file = formData.get("file");
  if (!buildingId || !(file instanceof File) || !file.size || !name) throw new Error("Name and file are required");

  const building = await db.building.findFirst({
    where: { id: buildingId, organizationId: user.organizationId },
  });
  if (!building || !assertBuildingAccess(user, building)) throw new Error("Building not found");
  const floorId = String(formData.get("floorId") || "") || null;
  if (floorId) {
    const floor = await db.buildingFloor.findFirst({ where: { id: floorId, buildingId } });
    if (!floor) throw new Error("Floor not found for this building");
  }

  const storageKey = await putUpload({ organizationId: user.organizationId, category: "plans", file });

  const plan = await db.floorPlan.create({
    data: {
      organizationId: user.organizationId,
      buildingId,
      floorId,
      name,
      storageKey,
      mimeType: file.type || "application/octet-stream",
      originalFilename: file.name,
    },
  });
  await activity({ user, organizationId: user.organizationId, clientId: building.clientId, buildingId, eventType: "document", title: "Floor plan uploaded", detail: plan.name });
  await audit({ user, action: "floor_plan.upload", recordType: "floor_plan", recordId: plan.id });
  revalidatePath(`/buildings/${buildingId}`);
  revalidatePath(`/buildings/${buildingId}/plans`);
  revalidatePath(`/buildings/${buildingId}/packet`);
  return { ok: true };
}

/** Enables mapping for an existing building document without uploading it again. */
export async function useDocumentAsFloorPlan(formData: FormData) {
  const user = await getSession();
  if (!user) throw new Error("Sign in required");
  if (!can(user, "documents.upload")) throw new Error("Not allowed to manage floor plans");
  const documentId = String(formData.get("documentId") || "");
  const document = await db.document.findFirst({
    where: { id: documentId, organizationId: user.organizationId, docType: "drawing" },
    include: { building: true },
  });
  if (!document?.building || !assertBuildingAccess(user, document.building)) throw new Error("Drawing document not found");

  const existing = await db.floorPlan.findFirst({ where: { buildingId: document.buildingId!, storageKey: document.storageKey } });
  const plan = existing ?? await db.floorPlan.create({
    data: {
      organizationId: user.organizationId,
      buildingId: document.buildingId!,
      name: document.name,
      storageKey: document.storageKey,
      mimeType: document.mimeType,
      originalFilename: document.originalFilename,
      notes: document.description,
    },
  });
  if (!existing) {
    await activity({ user, organizationId: user.organizationId, clientId: document.clientId, buildingId: document.buildingId!, eventType: "document", title: "Floor plan enabled", detail: plan.name });
    await audit({ user, action: "floor_plan.promote_document", recordType: "floor_plan", recordId: plan.id, newValue: { documentId: document.id } });
  }
  revalidatePath(`/buildings/${document.buildingId}`);
  revalidatePath(`/buildings/${document.buildingId}/plans`);
  redirect(`/buildings/${document.buildingId}/plans`);
}

export async function placeFloorPlanMarker(input: { floorPlanId: string; inventoryItemId: string; x: number; y: number }) {
  const user = await getSession();
  if (!user || !can(user, "inventory.edit")) throw new Error("Not allowed to place map pins");
  if (![input.x, input.y].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) throw new Error("Invalid map position");
  const plan = await db.floorPlan.findFirst({ where: { id: input.floorPlanId, organizationId: user.organizationId } });
  const item = await db.inventoryItem.findFirst({ where: { id: input.inventoryItemId, organizationId: user.organizationId, buildingId: plan?.buildingId } });
  if (!plan || !item) throw new Error("Floor plan or inventory item not found");
  const existing = await db.floorPlanMarker.findFirst({ where: { floorPlanId: plan.id, recordType: "inventory", recordId: item.id } });
  if (existing) await db.floorPlanMarker.update({ where: { id: existing.id }, data: { x: input.x, y: input.y, label: `${item.inventoryCode} · ${item.materialDescription}` } });
  else await db.floorPlanMarker.create({ data: { floorPlanId: plan.id, recordType: "inventory", recordId: item.id, x: input.x, y: input.y, label: `${item.inventoryCode} · ${item.materialDescription}` } });
  await audit({ user, action: "floor_plan.marker.place", recordType: "floor_plan", recordId: plan.id, newValue: input });
  revalidatePath(`/buildings/${plan.buildingId}/plans`);
  return { ok: true };
}
