"use server";

import { revalidatePath } from "next/cache";
import { hashPassword, sessionFromToken } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

async function userFrom(form: FormData) {
  const user = await sessionFromToken(value(form, "access"));
  if (!user || user.isClient || user.isContractor) throw new Error("Not allowed");
  return user;
}

async function administrator(form: FormData) {
  const user = await userFrom(form);
  if (!user.permissions.includes("users.manage")) throw new Error("Administrator access is required");
  return user;
}

function revalidateSettings() {
  revalidatePath("/settings");
}

export async function saveMyProfile(form: FormData) {
  const user = await userFrom(form);
  const data = {
    name: value(form, "name"),
    title: value(form, "title") || null,
    phone: value(form, "phone") || null,
  };
  if (!data.name) throw new Error("Your name is required");

  const previous = await db.user.findFirst({ where: { id: user.id, organizationId: user.organizationId } });
  if (!previous) throw new Error("User not found");
  await db.user.update({ where: { id: user.id }, data });
  await audit({ user, action: "user.profile.update", recordType: "user", recordId: user.id, previousValue: previous, newValue: data });
  revalidateSettings();
}

export async function saveOrganizationSettings(form: FormData) {
  const user = await administrator(form);
  const data = {
    name: value(form, "organizationName"),
    legalName: value(form, "legalName") || null,
    address: value(form, "address") || null,
    phone: value(form, "organizationPhone") || null,
    email: value(form, "organizationEmail") || null,
    website: value(form, "website") || null,
  };
  if (!data.name) throw new Error("Organization name is required");

  const previous = await db.organization.findUnique({ where: { id: user.organizationId } });
  if (!previous) throw new Error("Organization not found");
  await db.organization.update({ where: { id: previous.id }, data });
  await audit({ user, action: "organization.update", recordType: "organization", recordId: previous.id, previousValue: previous, newValue: data });
  revalidateSettings();
  revalidatePath("/dashboard");
}

export async function saveLaboratory(form: FormData) {
  const user = await administrator(form); const id = value(form, "id");
  const data = { name: value(form, "name"), accreditation: value(form, "accreditation") || null, address: value(form, "address") || null, phone: value(form, "phone") || null, email: value(form, "email") || null, notes: value(form, "notes") || null };
  if (!data.name) throw new Error("Laboratory name is required");
  const previous = id ? await db.laboratory.findFirst({ where: { id, organizationId: user.organizationId } }) : null;
  if (id && !previous) throw new Error("Laboratory not found");
  const record = previous ? await db.laboratory.update({ where: { id }, data }) : await db.laboratory.create({ data: { ...data, organizationId: user.organizationId } });
  await audit({ user, action: previous ? "laboratory.update" : "laboratory.create", recordType: "laboratory", recordId: record.id, previousValue: previous, newValue: data }); revalidateSettings();
}

export async function saveContractor(form: FormData) {
  const user = await administrator(form); const id = value(form, "id");
  const data = { name: value(form, "name"), license: value(form, "license") || null, contactName: value(form, "contactName") || null, phone: value(form, "phone") || null, email: value(form, "email") || null, address: value(form, "address") || null, notes: value(form, "notes") || null };
  if (!data.name) throw new Error("Contractor name is required");
  const previous = id ? await db.contractor.findFirst({ where: { id, organizationId: user.organizationId } }) : null;
  if (id && !previous) throw new Error("Contractor not found");
  const record = previous ? await db.contractor.update({ where: { id }, data }) : await db.contractor.create({ data: { ...data, organizationId: user.organizationId } });
  await audit({ user, action: previous ? "contractor.update" : "contractor.create", recordType: "contractor", recordId: record.id, previousValue: previous, newValue: data }); revalidateSettings();
}

export async function saveRegulatoryProfile(form: FormData) {
  const user = await administrator(form); const id = value(form, "id");
  const interval = Number(value(form, "inspectionIntervalDays") || "365");
  if (!Number.isInteger(interval) || interval < 1 || interval > 3650) throw new Error("Inspection interval must be between 1 and 3650 days");
  const data = { name: value(form, "name"), jurisdiction: value(form, "jurisdiction") || null, config: JSON.stringify({ inspectionIntervalDays: interval, requirePhotos: form.get("requirePhotos") === "on" }), isDefault: form.get("isDefault") === "on" };
  if (!data.name) throw new Error("Profile name is required");
  const previous = id ? await db.regulatoryProfile.findFirst({ where: { id, organizationId: user.organizationId } }) : null;
  if (id && !previous) throw new Error("Regulatory profile not found");
  if (data.isDefault) await db.regulatoryProfile.updateMany({ where: { organizationId: user.organizationId, id: { not: id || "__new__" } }, data: { isDefault: false } });
  const record = previous ? await db.regulatoryProfile.update({ where: { id }, data }) : await db.regulatoryProfile.create({ data: { ...data, organizationId: user.organizationId } });
  await audit({ user, action: previous ? "regulatory_profile.update" : "regulatory_profile.create", recordType: "regulatory_profile", recordId: record.id, previousValue: previous, newValue: data }); revalidateSettings();
}

export async function saveRole(form: FormData) {
  const user = await administrator(form); const id = value(form, "id");
  const slug = value(form, "slug").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const permissions = PERMISSIONS.filter((permission) => form.getAll("permissions").includes(permission));
  const data = { name: value(form, "name"), slug, description: value(form, "description") || null, permissions: JSON.stringify(permissions) };
  if (!data.name || !slug) throw new Error("Role name and slug are required");
  const previous = id ? await db.role.findFirst({ where: { id, organizationId: user.organizationId } }) : null;
  if (id && !previous) throw new Error("Role not found");
  if (previous?.isSystem) throw new Error("System roles cannot be changed");
  const record = previous ? await db.role.update({ where: { id }, data }) : await db.role.create({ data: { ...data, organizationId: user.organizationId, isSystem: false } });
  await audit({ user, action: previous ? "role.update" : "role.create", recordType: "role", recordId: record.id, previousValue: previous, newValue: data }); revalidateSettings();
}

export async function saveUser(form: FormData) {
  const user = await administrator(form); const id = value(form, "id"); const roleId = value(form, "roleId");
  const role = await db.role.findFirst({ where: { id: roleId, organizationId: user.organizationId } }); if (!role) throw new Error("Select a valid organization role");
  const data = { name: value(form, "name"), email: value(form, "email").toLowerCase(), title: value(form, "title") || null, phone: value(form, "phone") || null, roleId, status: value(form, "status") || "active" };
  if (!data.name || !data.email.includes("@")) throw new Error("Name and a valid email are required");
  const previous = id ? await db.user.findFirst({ where: { id, organizationId: user.organizationId } }) : null;
  if (id && !previous) throw new Error("User not found");
  if (previous && previous.id === user.id && data.status !== "active") throw new Error("You cannot deactivate your own account");
  let record;
  if (previous) record = await db.user.update({ where: { id }, data });
  else { const password = value(form, "password"); if (password.length < 12) throw new Error("New user passwords must be at least 12 characters"); record = await db.user.create({ data: { ...data, organizationId: user.organizationId, passwordHash: await hashPassword(password), mfaEnabled: false } }); }
  await audit({ user, action: previous ? "user.update" : "user.create", recordType: "user", recordId: record.id, previousValue: previous, newValue: { ...data, password: undefined } }); revalidateSettings();
}
