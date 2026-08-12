"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { putUpload } from "@/lib/storage";

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

  const storageKey = await putUpload({ organizationId: user.organizationId, category: "plans", file });

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
