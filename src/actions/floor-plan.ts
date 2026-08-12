"use server";

import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function uploadFloorPlan(formData: FormData) {
  const user = await getSession();
  if (!user) throw new Error("Sign in required");
  const buildingId = String(formData.get("buildingId") || "");
  const name = String(formData.get("name") || "").trim();
  const file = formData.get("file") as File | null;
  if (!buildingId || !file || !name) throw new Error("Name and file are required");

  const building = await db.building.findFirst({
    where: { id: buildingId, organizationId: user.organizationId },
  });
  if (!building) throw new Error("Building not found");

  const buf = Buffer.from(await file.arrayBuffer());
  const safe = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const dir = path.join(process.cwd(), "uploads", "plans");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, safe), buf);
  const storageKey = `uploads/plans/${safe}`;

  await db.floorPlan.create({
    data: {
      organizationId: user.organizationId,
      buildingId,
      name,
      storageKey,
      mimeType: file.type || "application/octet-stream",
      originalFilename: file.name,
    },
  });
  revalidatePath(`/buildings/${buildingId}`);
  revalidatePath(`/buildings/${buildingId}/plans`);
  revalidatePath(`/buildings/${buildingId}/packet`);
  return { ok: true };
}
