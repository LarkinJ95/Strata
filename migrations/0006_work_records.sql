CREATE TABLE "WorkRecord" (
  "id" TEXT NOT NULL PRIMARY KEY, "organizationId" TEXT NOT NULL, "clientId" TEXT NOT NULL, "facilityId" TEXT NOT NULL, "buildingId" TEXT NOT NULL,
  "workNumber" TEXT NOT NULL, "workType" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT, "status" TEXT NOT NULL DEFAULT 'open', "priority" TEXT NOT NULL DEFAULT 'medium',
  "dueDate" DATETIME, "completedAt" DATETIME, "vendorName" TEXT, "contractorId" TEXT, "assignedUserId" TEXT, "poNumber" TEXT, "costEstimate" REAL, "actualCost" REAL,
  "createdById" TEXT, "completedById" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON UPDATE CASCADE, FOREIGN KEY ("facilityId") REFERENCES "Facility" ("id") ON UPDATE CASCADE,
  FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE, FOREIGN KEY ("contractorId") REFERENCES "Contractor" ("id") ON UPDATE CASCADE, FOREIGN KEY ("assignedUserId") REFERENCES "User" ("id") ON UPDATE CASCADE,
  FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON UPDATE CASCADE, FOREIGN KEY ("completedById") REFERENCES "User" ("id") ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WorkRecord_organizationId_workNumber_key" ON "WorkRecord"("organizationId", "workNumber");
CREATE INDEX "WorkRecord_organizationId_status_dueDate_idx" ON "WorkRecord"("organizationId", "status", "dueDate");
CREATE INDEX "WorkRecord_organizationId_buildingId_idx" ON "WorkRecord"("organizationId", "buildingId");
CREATE TABLE "WorkRecordItem" (
  "id" TEXT NOT NULL PRIMARY KEY, "workRecordId" TEXT NOT NULL, "inventoryItemId" TEXT NOT NULL, "workNotes" TEXT, "outcome" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("workRecordId") REFERENCES "WorkRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WorkRecordItem_workRecordId_inventoryItemId_key" ON "WorkRecordItem"("workRecordId", "inventoryItemId");
CREATE INDEX "WorkRecordItem_inventoryItemId_idx" ON "WorkRecordItem"("inventoryItemId");
ALTER TABLE "Document" ADD COLUMN "workRecordId" TEXT REFERENCES "WorkRecord"("id") ON UPDATE CASCADE;
CREATE INDEX "Document_workRecordId_idx" ON "Document"("workRecordId");
