"use client";

import { readStoredSession } from "@/lib/session-client";

/** Frame dimensions, read from the blob so no server-side decode is needed. */
export function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (typeof createImageBitmap !== "function") {
      resolve(null);
      return;
    }
    createImageBitmap(file)
      .then((bitmap) => {
        const size = { width: bitmap.width, height: bitmap.height };
        bitmap.close?.();
        resolve(size);
      })
      .catch(() => resolve(null));
  });
}

/**
 * Coordinates, if the browser will give them up. Capped at four seconds so a
 * slow fix in a steel building never holds up the upload.
 */
export function readPosition(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (value: { latitude: number; longitude: number } | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 4000);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        finish({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        finish(null);
      },
      { enableHighAccuracy: false, maximumAge: 120000, timeout: 4000 }
    );
  });
}

/**
 * Stores one photograph against an inventory record, carrying whatever
 * provenance the device will provide. `primaryPhoto: "auto"` promotes the first
 * photograph an item receives so it becomes the visible thumbnail, without
 * overriding a primary someone has chosen deliberately.
 */
export async function uploadCapture(options: {
  file: File;
  buildingId: string;
  inventoryId: string;
  caption?: string;
  category?: string;
}) {
  const { file, buildingId, inventoryId, caption, category } = options;
  const body = new FormData();
  body.set("file", file);
  body.set("buildingId", buildingId);
  body.set("recordType", "inventory");
  body.set("recordId", inventoryId);
  body.set("category", category ?? "material");
  if (caption) body.set("caption", caption);
  body.set("primaryPhoto", "auto");
  if (file.lastModified) body.set("capturedAt", new Date(file.lastModified).toISOString());

  const size = await readImageSize(file);
  if (size) {
    body.set("width", String(size.width));
    body.set("height", String(size.height));
  }
  const position = await readPosition();
  if (position) {
    body.set("latitude", String(position.latitude));
    body.set("longitude", String(position.longitude));
  }

  const token = readStoredSession();
  const response = await fetch(`/api/buildings/${buildingId}/photos`, {
    method: "POST",
    body,
    headers: token ? { "x-strata-session": token } : undefined,
  });
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; photo?: { id: string; storageKey: string } }
    | null;
  if (!response.ok || !payload?.photo) throw new Error(payload?.error || "Could not store photograph.");
  return payload.photo;
}
