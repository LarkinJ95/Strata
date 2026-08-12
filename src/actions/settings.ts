"use server";

import { revalidatePath } from "next/cache";
import { sessionFromToken } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

async function userFrom(form: FormData) {
  const user = await sessionFromToken(value(form, "access"));
  if (!user || user.isClient || user.isContractor) throw new Error("Not allowed");
  return user;
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
  revalidatePath("/settings");
}

export async function saveOrganizationSettings(form: FormData) {
  const user = await userFrom(form);
  if (!user.permissions.includes("users.manage")) throw new Error("Administrator access is required");
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
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}
