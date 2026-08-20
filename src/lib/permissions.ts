export const PERMISSIONS = [
  "inventory.view",
  "inventory.edit",
  "inventory.create",
  "samples.add",
  "samples.results.enter",
  "samples.results.approve",
  "samples.reconcile",
  "inspections.perform",
  "inspections.approve",
  "photos.add",
  "photos.download",
  "repairs.create",
  "repairs.close",
  "repairs.verify",
  "work.view",
  "work.create",
  "work.edit",
  "removals.record",
  "documents.upload",
  "documents.download",
  "reports.generate",
  "audit.view",
  "users.manage",
  "clients.manage",
  "costs.view",
  "portal.view",
  "buildings.manage",
  "facilities.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS];

export const ROLE_PRESETS: Record<string, Permission[]> = {
  org_admin: ALL_PERMISSIONS,
  environmental_manager: [
    "inventory.view",
    "inventory.edit",
    "inventory.create",
    "samples.add",
    "samples.results.enter",
    "samples.results.approve",
    "samples.reconcile",
    "inspections.perform",
    "inspections.approve",
    "photos.add",
    "photos.download",
    "repairs.create",
    "repairs.close",
    "repairs.verify",
    "work.view",
    "work.create",
    "work.edit",
    "removals.record",
    "documents.upload",
    "documents.download",
    "reports.generate",
    "audit.view",
    "users.manage",
    "clients.manage",
    "costs.view",
    "buildings.manage",
    "facilities.manage",
  ],
  inspector: [
    "inventory.view",
    "inventory.edit",
    "inventory.create",
    "samples.add",
    "inspections.perform",
    "photos.add",
    "photos.download",
    "repairs.create",
    "work.view",
    "work.create",
    "documents.upload",
    "documents.download",
    "reports.generate",
  ],
  technician: [
    "inventory.view",
    "samples.add",
    "photos.add",
    "documents.upload",
  ],
  client_admin: [
    "inventory.view",
    "photos.download",
    "documents.download",
    "reports.generate",
    "portal.view",
    "audit.view",
    "work.view",
  ],
  client_viewer: [
    "inventory.view",
    "photos.download",
    "documents.download",
    "portal.view",
    "work.view",
  ],
  contractor: [
    "inventory.view",
    "photos.add",
    "photos.download",
    "repairs.create",
    "work.view",
    "work.create",
    "documents.upload",
    "documents.download",
  ],
};

export function parsePermissions(raw: string): Permission[] {
  try {
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter((p): p is Permission =>
      (PERMISSIONS as readonly string[]).includes(p)
    );
  } catch {
    return [];
  }
}

export function hasPermission(
  permissions: Permission[],
  required: Permission | Permission[]
): boolean {
  const need = Array.isArray(required) ? required : [required];
  return need.every((p) => permissions.includes(p));
}
