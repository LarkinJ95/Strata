"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sessionFromToken } from "@/lib/auth";
import { persistBuildingCompliance } from "@/lib/compliance";
import { activity, audit } from "@/lib/audit";

async function actor(form: FormData) {
  const user = await sessionFromToken(String(form.get("access") || ""));
  if (!user || user.isClient) throw new Error("Not allowed");
  return user;
}

function str(form: FormData, key: string) {
  const v = form.get(key);
  return v == null ? "" : String(v).trim();
}
function num(form: FormData, key: string) {
  const v = str(form, key);
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function dateOrNull(form: FormData, key: string) {
  const v = str(form, key);
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function saveClient(form: FormData) {
  const user = await actor(form);
  const id = str(form, "id");
  const data = {
    name: str(form, "name"),
    clientNumber: str(form, "clientNumber"),
    primaryContact: str(form, "primaryContact") || null,
    primaryEmail: str(form, "primaryEmail") || null,
    primaryPhone: str(form, "primaryPhone") || null,
    address: str(form, "address") || null,
    city: str(form, "city") || null,
    state: str(form, "state") || null,
    postalCode: str(form, "postalCode") || null,
    photoPolicy: str(form, "photoPolicy") || "permitted",
    inspectionReqs: str(form, "inspectionReqs") || null,
    notes: str(form, "notes") || null,
  };
  if (!data.name || !data.clientNumber) throw new Error("Name and client number are required");

  if (id) {
    const existing = await db.client.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!existing) throw new Error("Client not found");
    await db.client.update({ where: { id }, data });
    await audit({ user, action: "client.update", recordType: "client", recordId: id, previousValue: existing, newValue: data });
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    return;
  }

  const created = await db.client.create({ data: { ...data, organizationId: user.organizationId } });
  await audit({ user, action: "client.create", recordType: "client", recordId: created.id, newValue: data });
  revalidatePath("/clients");
  redirect(`/clients/${created.id}`);
}

export async function saveFacility(form: FormData) {
  const user = await actor(form);
  const id = str(form, "id");
  const clientId = str(form, "clientId");
  const client = await db.client.findFirst({ where: { id: clientId, organizationId: user.organizationId } });
  if (!client) throw new Error("Client not found");
  const data = { name: str(form, "name"), facilityId: str(form, "facilityId"), address: str(form, "address") || null, city: str(form, "city") || null, state: str(form, "state") || null, postalCode: str(form, "postalCode") || null, primaryContact: str(form, "primaryContact") || null, environmentalContact: str(form, "environmentalContact") || null, emergencyContact: str(form, "emergencyContact") || null, notes: str(form, "notes") || null, status: str(form, "status") || "active" };
  if (!data.name || !data.facilityId) throw new Error("Facility name and ID are required");
  if (id) {
    const existing = await db.facility.findFirst({ where: { id, organizationId: user.organizationId, clientId } });
    if (!existing) throw new Error("Facility not found");
    await db.facility.update({ where: { id }, data });
    await audit({ user, action: "facility.update", recordType: "facility", recordId: id, previousValue: existing, newValue: data });
    revalidatePath(`/clients/${clientId}`);
    return;
  }
  const created = await db.facility.create({ data: { ...data, organizationId: user.organizationId, clientId } });
  await audit({ user, action: "facility.create", recordType: "facility", recordId: created.id, newValue: data });
  revalidatePath(`/clients/${clientId}`);
}

export async function saveBuilding(form: FormData) {
  const user = await actor(form);
  const id = str(form, "id");
  const data = {
    name: str(form, "name"),
    buildingNumber: str(form, "buildingNumber"),
    address: str(form, "address") || null,
    yearConstructed: num(form, "yearConstructed"),
    squareFootage: num(form, "squareFootage"),
    floorsCount: num(form, "floorsCount"),
    buildingUse: str(form, "buildingUse") || null,
    occupancyStatus: str(form, "occupancyStatus") || "occupied",
    photoPolicy: str(form, "photoPolicy") || "permitted",
    surveyStatus: str(form, "surveyStatus") || "complete",
    managementPlanStatus: str(form, "managementPlanStatus") || "current",
    notes: str(form, "notes") || null,
    lastInspectionAt: dateOrNull(form, "lastInspectionAt"),
    nextInspectionAt: dateOrNull(form, "nextInspectionAt"),
  };
  if (!data.name || !data.buildingNumber) throw new Error("Name and building number are required");

  if (id) {
    const existing = await db.building.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!existing) throw new Error("Building not found");
    await db.building.update({ where: { id }, data });
    await persistBuildingCompliance(id);
    await audit({ user, action: "building.update", recordType: "building", recordId: id, previousValue: existing, newValue: data });
    revalidatePath(`/buildings/${id}`);
    return;
  }

  const facilityId = str(form, "facilityId");
  const facility = await db.facility.findFirst({ where: { id: facilityId, organizationId: user.organizationId } });
  if (!facility) throw new Error("Facility not found");
  const created = await db.building.create({
    data: {
      ...data,
      organizationId: user.organizationId,
      clientId: facility.clientId,
      facilityId: facility.id,
    },
  });
  revalidatePath(`/clients/${facility.clientId}`);
  redirect(`/buildings/${created.id}`);
}

export async function saveInventory(form: FormData) {
  const user = await actor(form);
  const id = str(form, "id");
  const buildingId = str(form, "buildingId");
  const qty = num(form, "currentQuantity");
  const patch = {
    materialDescription: str(form, "materialDescription"),
    materialCategory: str(form, "materialCategory") || "Miscellaneous",
    floor: str(form, "floor") || null,
    room: str(form, "room") || null,
    specificLocation: str(form, "specificLocation") || null,
    acmClassification: str(form, "acmClassification") || "unknown",
    condition: str(form, "condition") || "good",
    quantityUnit: str(form, "quantityUnit") || "SF",
    currentQuantity: qty,
    asbestosPercent: num(form, "asbestosPercent"),
    labelCondition: str(form, "labelCondition") || null,
    responseAction: str(form, "responseAction") || null,
    friable: str(form, "friable") || null,
    notes: str(form, "notes") || null,
    recordStatus: str(form, "recordStatus") || "active",
  };

  if (id) {
    const inv = await db.inventoryItem.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!inv) throw new Error("Inventory not found");
    if (qty != null && qty !== inv.currentQuantity) {
      await db.inventoryQuantityHistory.create({
        data: {
          inventoryItemId: id,
          previousQty: inv.currentQuantity,
          newQty: qty,
          delta: qty - (inv.currentQuantity ?? 0),
          unit: patch.quantityUnit,
          reason: "Edited in building inventory",
          changedById: user.id,
        },
      });
    }
    if (patch.condition !== inv.condition) {
      await db.inventoryConditionHistory.create({
        data: {
          inventoryItemId: id,
          previousCondition: inv.condition,
          newCondition: patch.condition,
          inspectorId: user.id,
        },
      });
    }
    await db.inventoryItem.update({ where: { id }, data: patch });
    await persistBuildingCompliance(inv.buildingId);
    await audit({ user, action: "inventory.update", recordType: "inventory", recordId: id, previousValue: inv, newValue: patch });
    revalidatePath(`/buildings/${inv.buildingId}`);
    revalidatePath(`/inventory/${id}`);
    return;
  }

  const building = await db.building.findFirst({ where: { id: buildingId, organizationId: user.organizationId } });
  if (!building) throw new Error("Building not found");
  const last = await db.inventoryItem.findFirst({ where: { buildingId }, orderBy: { inventoryCode: "desc" } });
  const n = last ? Number(String(last.inventoryCode.split("-").pop()) || 0) + 1 : 1;
  const code = `${building.buildingNumber.replace("-", "")}-${String(n).padStart(3, "0")}`;
  const created = await db.inventoryItem.create({
    data: {
      ...patch,
      organizationId: user.organizationId,
      clientId: building.clientId,
      facilityId: building.facilityId,
      buildingId,
      inventoryCode: code,
      originalQuantity: qty,
    },
  });
  if (qty != null) {
    await db.inventoryQuantityHistory.create({
      data: {
        inventoryItemId: created.id,
        newQty: qty,
        unit: patch.quantityUnit,
        reason: "Created in building inventory",
        changedById: user.id,
      },
    });
  }
  await persistBuildingCompliance(buildingId);
  revalidatePath(`/buildings/${buildingId}`);
}

export async function saveSample(form: FormData) {
  const user = await actor(form);
  const id = str(form, "id");
  const buildingId = str(form, "buildingId");
  const data = {
    material: str(form, "material"),
    floor: str(form, "floor") || null,
    room: str(form, "room") || null,
    location: str(form, "location") || null,
    status: str(form, "status") || "collected",
    notes: str(form, "notes") || null,
  };
  if (id) {
    const sample = await db.sample.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!sample) throw new Error("Sample not found");
    await db.sample.update({ where: { id }, data });
    revalidatePath(`/buildings/${sample.buildingId}`);
    revalidatePath(`/samples/${id}`);
    return;
  }
  const building = await db.building.findFirst({ where: { id: buildingId, organizationId: user.organizationId } });
  if (!building) throw new Error("Building not found");
  const last = await db.sample.findFirst({
    where: { organizationId: user.organizationId, sampleNumber: { startsWith: "26-" } },
    orderBy: { sampleNumber: "desc" },
  });
  const n = last ? Number(last.sampleNumber.split("-").pop()) + 1 : 1;
  const created = await db.sample.create({
    data: {
      ...data,
      organizationId: user.organizationId,
      clientId: building.clientId,
      buildingId,
      sampleNumber: `26-${String(n).padStart(3, "0")}`,
      collectionDate: new Date(),
      inspectorId: user.id,
    },
  });
  await db.sampleLayer.create({ data: { sampleId: created.id, layerNumber: 1, description: data.material || "Layer 1" } });
  revalidatePath(`/buildings/${buildingId}`);
}

export async function saveRepair(form: FormData) {
  const user = await actor(form);
  const id = str(form, "id");
  const data = {
    problem: str(form, "problem"),
    priority: str(form, "priority") || "medium",
    status: str(form, "status") || "open",
    recommendedResponse: str(form, "recommendedResponse") || null,
    workOrderNumber: str(form, "workOrderNumber") || null,
    scheduledDate: dateOrNull(form, "scheduledDate"),
    notes: str(form, "notes") || null,
  };
  if (id) {
    const repair = await db.repair.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!repair) throw new Error("Repair not found");
    await db.repair.update({ where: { id }, data });
    await persistBuildingCompliance(repair.buildingId);
    revalidatePath(`/buildings/${repair.buildingId}`);
    revalidatePath(`/repairs/${id}`);
    return;
  }
  const inventoryItemId = str(form, "inventoryItemId");
  const inv = await db.inventoryItem.findFirst({ where: { id: inventoryItemId, organizationId: user.organizationId } });
  if (!inv) throw new Error("Inventory not found");
  const last = await db.repair.findFirst({ where: { organizationId: user.organizationId }, orderBy: { repairCode: "desc" } });
  const n = last?.repairCode?.startsWith("R-26") ? Number(last.repairCode.split("-").pop()) + 1 : 1;
  await db.repair.create({
    data: {
      ...data,
      organizationId: user.organizationId,
      clientId: inv.clientId,
      buildingId: inv.buildingId,
      inventoryItemId: inv.id,
      repairCode: `R-26-${String(n).padStart(3, "0")}`,
      condition: inv.condition,
      inspectorId: user.id,
    },
  });
  await persistBuildingCompliance(inv.buildingId);
  revalidatePath(`/buildings/${inv.buildingId}`);
}

export async function saveInspectionMeta(form: FormData) {
  const user = await actor(form);
  const id = str(form, "id");
  const inspection = await db.inspection.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!inspection) throw new Error("Inspection not found");
  await db.inspection.update({
    where: { id },
    data: {
      inspectionType: str(form, "inspectionType") || inspection.inspectionType,
      status: str(form, "status") || inspection.status,
      notes: str(form, "notes") || null,
      scheduledDate: dateOrNull(form, "scheduledDate") ?? inspection.scheduledDate,
    },
  });
  revalidatePath(`/buildings/${inspection.buildingId}`);
}

export async function saveFloor(form: FormData) {
  const user = await actor(form);
  const buildingId = str(form, "buildingId");
  const building = await db.building.findFirst({ where: { id: buildingId, organizationId: user.organizationId } });
  if (!building) throw new Error("Building not found");
  const id = str(form, "id");
  const data = {
    name: str(form, "name") || "New floor",
    level: num(form, "level") ?? 1,
    notes: str(form, "notes") || null,
    occupancy: str(form, "occupancy") || null,
    squareFootage: num(form, "squareFootage"),
  };
  if (id) await db.buildingFloor.update({ where: { id }, data });
  else await db.buildingFloor.create({ data: { ...data, buildingId } });
  revalidatePath(`/buildings/${buildingId}`);
}

export async function saveFunctionalArea(form: FormData) {
  const user = await actor(form);
  const buildingId = str(form, "buildingId");
  const building = await db.building.findFirst({ where: { id: buildingId, organizationId: user.organizationId } });
  if (!building) throw new Error("Building not found");
  const id = str(form, "id");
  const data = {
    name: str(form, "name") || "New FA",
    faCode: str(form, "faCode") || null,
    floorId: str(form, "floorId") || null,
    areaType: str(form, "areaType") || "room",
    useDescription: str(form, "useDescription") || null,
    notes: str(form, "notes") || null,
  };
  if (id) await db.buildingArea.update({ where: { id }, data });
  else await db.buildingArea.create({ data: { ...data, buildingId } });
  revalidatePath(`/buildings/${buildingId}`);
}

export async function savePaintSample(form: FormData) {
  const user = await actor(form);
  const buildingId = str(form, "buildingId");
  const building = await db.building.findFirst({ where: { id: buildingId, organizationId: user.organizationId } });
  if (!building) throw new Error("Building not found");
  const id = str(form, "id");
  const lead = str(form, "leadDetected");
  const data = {
    floorId: str(form, "floorId") || null,
    areaId: str(form, "areaId") || null,
    floor: str(form, "floor") || null,
    room: str(form, "room") || null,
    location: str(form, "location") || null,
    component: str(form, "component") || null,
    color: str(form, "color") || null,
    substrate: str(form, "substrate") || null,
    laboratory: str(form, "laboratory") || null,
    method: str(form, "method") || "XRF",
    leadDetected: lead === "" ? null : lead === "yes",
    leadPpm: num(form, "leadPpm"),
    leadMgCm2: num(form, "leadMgCm2"),
    asbestosPaint: str(form, "asbestosPaint") === "yes" ? true : str(form, "asbestosPaint") === "no" ? false : null,
    resultSummary: str(form, "resultSummary") || null,
    status: str(form, "status") || "results_received",
    notes: str(form, "notes") || null,
    collectionDate: dateOrNull(form, "collectionDate") ?? new Date(),
  };
  if (id) {
    await db.paintSample.update({ where: { id }, data });
  } else {
    const last = await db.paintSample.findFirst({ where: { buildingId }, orderBy: { sampleNumber: "desc" } });
    const n = last ? Number(String(last.sampleNumber.split("-").pop()) || 0) + 1 : 1;
    await db.paintSample.create({
      data: {
        ...data,
        organizationId: user.organizationId,
        buildingId,
        sampleNumber: `PB-${String(n).padStart(3, "0")}`,
      },
    });
  }
  revalidatePath(`/buildings/${buildingId}`);
}

export async function savePpe(form: FormData) {
  const user = await actor(form);
  const buildingId = str(form, "buildingId");
  const building = await db.building.findFirst({ where: { id: buildingId, organizationId: user.organizationId } });
  if (!building) throw new Error("Building not found");
  const id = str(form, "id");
  const data = {
    item: str(form, "item"),
    required: str(form, "required") !== "no",
    appliesTo: str(form, "appliesTo") || "Entire building",
    notes: str(form, "notes") || null,
  };
  if (!data.item) throw new Error("PPE item is required");
  if (id) await db.buildingPpe.update({ where: { id }, data });
  else await db.buildingPpe.create({ data: { ...data, buildingId } });
  revalidatePath(`/buildings/${buildingId}`);
}

export async function deletePpe(form: FormData) {
  const user = await actor(form);
  const id = str(form, "id");
  const row = await db.buildingPpe.findUnique({ where: { id } });
  if (!row) return;
  const building = await db.building.findFirst({ where: { id: row.buildingId, organizationId: user.organizationId } });
  if (!building) throw new Error("Not allowed");
  await db.buildingPpe.delete({ where: { id } });
  revalidatePath(`/buildings/${row.buildingId}`);
}
