export function fileUrl(storageKey: string) {
  if (storageKey.startsWith("demo/")) return `/${storageKey}`;
  if (storageKey.startsWith("uploads/")) return `/api/files/${storageKey}`;
  return `/api/files/${storageKey}`;
}
