import type { Permission } from "./permissions";

export type SessionUser = {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  clientId: string | null;
  clientName: string | null;
  contractorId: string | null;
  roleSlug: string;
  roleName: string;
  permissions: Permission[];
  email: string;
  name: string;
  title: string | null;
  assignedBuildingIds: string[];
  isClient: boolean;
  isContractor: boolean;
};

export type Scope = {
  organizationId: string;
  clientId?: string;
  buildingId?: { in: string[] };
};
