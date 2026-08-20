"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertBuildingAccess, can, sessionFromToken } from "@/lib/auth";
import { activity, audit } from "@/lib/audit";
import { putUpload } from "@/lib/storage";

const TYPES = new Set(["WO", "PO", "PMO"]);
const STATUSES = new Set(["open", "in_progress", "on_hold", "completed", "cancelled"]);
const PRIORITIES = new Set(["low", "medium", "high", "critical"]);

function text(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}
function date(form: FormData, key: string) {
  const value = text(form, key);
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function amount(form: FormData, key: string) {
  const value = text(form, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function jsonMap(value: string) {
  try { return JSON.parse(value) as Record<string, string>; } catch { return {}; }
}

async function workActor(form: FormData, permission: "work.create" | "work.edit") {
  const user = await sessionFromToken(text(form, "access"));
  const manager = user && ["org_admin", "environmental_manager"].includes(user.roleSlug);
  if (!user || user.isClient || (!manager && !can(user, permission))) throw new Error("Not allowed to manage work records");
  return user;
}

async function nextWorkNumber(organizationId: string, type: string) {
  const year = new Date().getUTCFullYear();
  const prefix = `${type}-${year}-`;
  const latest = await db.workRecord.findFirst({
    where: { organizationId, workNumber: { startsWith: prefix } },
    orderBy: { workNumber: "desc" }, select: { workNumber: true },
  });
  const number = latest ? Number(latest.workNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(Number.isFinite(number) ? number : 1).padStart(4, "0")}`;
}

export async function saveWorkRecord(form: FormData) {
  const id = text(form, "id");
  const user = await workActor(form, id ? "work.edit" : "work.create");
  const buildingId = text(form, "buildingId");
  const building = await db.building.findFirst({ where: { id: buildingId, organizationId: user.organizationId } });
  if (!building || !assertBuildingAccess(user, building)) throw new Error("Building not found");
  const workType = text(form, "workType");
  const status = text(form, "status") || "open";
  const priority = text(form, "priority") || "medium";
  const title = text(form, "title");
  if (!TYPES.has(workType) || !STATUSES.has(status) || !PRIORITIES.has(priority) || !title) throw new Error("Complete the required work record fields");
  const itemIds = [...new Set(Object.keys(jsonMap(text(form, "itemIds"))))];
  const items = itemIds.length ? await db.inventoryItem.findMany({ where: { id: { in: itemIds }, buildingId, organizationId: user.organizationId }, select: { id: true } }) : [];
  if (items.length !== itemIds.length) throw new Error("Affected materials must belong to this building");
  const assignedUserId = text(form, "assignedUserId");
  if (assignedUserId && !await db.user.findFirst({ where: { id: assignedUserId, organizationId: user.organizationId }, select: { id: true } })) throw new Error("Assignee not found");
  const contractorId = text(form, "contractorId");
  if (contractorId && !await db.contractor.findFirst({ where: { id: contractorId, organizationId: user.organizationId }, select: { id: true } })) throw new Error("Contractor not found");
  const notes = jsonMap(text(form, "itemNotes"));
  const outcomes = jsonMap(text(form, "itemOutcomes"));
  const data = {
    workType, title, description: text(form, "description") || null, status, priority,
    dueDate: date(form, "dueDate"), vendorName: text(form, "vendorName") || null, contractorId: contractorId || null, assignedUserId: assignedUserId || null,
    poNumber: text(form, "poNumber") || null, costEstimate: amount(form, "costEstimate"), actualCost: amount(form, "actualCost"),
    completedAt: status === "completed" ? new Date() : null,
    completedById: status === "completed" ? user.id : null,
  };
  let workId = id;
  if (id) {
    const existing = await db.workRecord.findFirst({ where: { id, organizationId: user.organizationId, buildingId } });
    if (!existing) throw new Error("Work record not found");
    await db.workRecord.update({ where: { id }, data });
    await db.workRecordItem.deleteMany({ where: { workRecordId: id } });
    await audit({ user, action: "work.update", recordType: "work_record", recordId: id, previousValue: existing, newValue: data });
  } else {
    const workNumber = await nextWorkNumber(user.organizationId, workType);
    const created = await db.workRecord.create({ data: { ...data, workNumber, organizationId: user.organizationId, clientId: building.clientId, facilityId: building.facilityId, buildingId, createdById: user.id } });
    workId = created.id;
    await activity({ user, organizationId: user.organizationId, clientId: building.clientId, buildingId, eventType: "work", title: `${workType} ${workNumber} opened`, detail: title });
    await audit({ user, action: "work.create", recordType: "work_record", recordId: workId, newValue: { ...data, workNumber } });
  }
  if (items.length) await db.workRecordItem.createMany({ data: items.map((item) => ({ workRecordId: workId, inventoryItemId: item.id, workNotes: notes[item.id] || null, outcome: outcomes[item.id] || null })) });
  if (status === "completed") await activity({ user, organizationId: user.organizationId, clientId: building.clientId, buildingId, eventType: "work", title: `Work ${id ? "updated" : "completed"}`, detail: title });
  revalidatePath("/work");
  revalidatePath(`/work/${workId}`);
  revalidatePath(`/buildings/${buildingId}`);
  return workId;
}

export async function uploadWorkDocument(form: FormData) {
  const user = await sessionFromToken(text(form, "access"));
  if (!user || !can(user, "documents.upload")) throw new Error("Not allowed to upload documents");
  const workRecordId = text(form, "workRecordId");
  const work = await db.workRecord.findFirst({ where: { id: workRecordId, organizationId: user.organizationId }, include: { building: true } });
  if (!work || !assertBuildingAccess(user, work.building)) throw new Error("Work record not found");
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) throw new Error("Choose a file to upload");
  const storageKey = await putUpload({ organizationId: user.organizationId, category: "work-documents", file });
  const document = await db.document.create({ data: {
    organizationId: user.organizationId, clientId: work.clientId, buildingId: work.buildingId, workRecordId: work.id,
    name: text(form, "name") || file.name, docType: text(form, "docType") || "work_record", storageKey,
    originalFilename: file.name, mimeType: file.type || "application/octet-stream", size: file.size,
    documentDate: date(form, "documentDate"), description: text(form, "description") || null, visibility: "internal", uploadedById: user.id,
  } });
  await activity({ user, organizationId: user.organizationId, clientId: work.clientId, buildingId: work.buildingId, eventType: "document", title: "Work document uploaded", detail: document.name });
  await audit({ user, action: "work.document.upload", recordType: "document", recordId: document.id });
  revalidatePath(`/work/${work.id}`); revalidatePath(`/buildings/${work.buildingId}`);
  return { id: document.id, storageKey };
}
