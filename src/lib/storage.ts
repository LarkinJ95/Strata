import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function safeFilename(filename: string) {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  return sanitized || "upload";
}

export function storageKeyForUpload(organizationId: string, category: string, filename: string) {
  const safeCategory = category.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `organizations/${organizationId}/uploads/${safeCategory}/${crypto.randomUUID()}-${safeFilename(filename)}`;
}

export function canReadStorageKey(organizationId: string, storageKey: string) {
  return storageKey.startsWith(`organizations/${organizationId}/`);
}

export async function putUpload(input: {
  organizationId: string;
  category: string;
  file: File;
}) {
  if (input.file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Files must be 25 MB or smaller");
  }

  const storageKey = storageKeyForUpload(input.organizationId, input.category, input.file.name);
  const { env } = getCloudflareContext();
  await env.FILES.put(storageKey, await input.file.arrayBuffer(), {
    httpMetadata: { contentType: input.file.type || "application/octet-stream" },
    customMetadata: { organizationId: input.organizationId, originalFilename: input.file.name },
  });
  return storageKey;
}

export async function getStoredObject(storageKey: string) {
  const { env } = getCloudflareContext();
  return env.FILES.get(storageKey);
}
