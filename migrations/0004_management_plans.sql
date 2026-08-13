CREATE TABLE "ManagementPlan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "buildingId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "effectiveDate" DATETIME,
  "reviewDueDate" DATETIME,
  "preparedBy" TEXT,
  "approvedBy" TEXT,
  "approvedAt" DATETIME,
  "responsiblePerson" TEXT,
  "responseProcedures" TEXT,
  "emergencyProcedures" TEXT,
  "trainingNotes" TEXT,
  "notificationNotes" TEXT,
  "additionalNotes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagementPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ManagementPlan_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ManagementPlan_buildingId_revision_key" ON "ManagementPlan"("buildingId", "revision");
CREATE INDEX "ManagementPlan_organizationId_buildingId_idx" ON "ManagementPlan"("organizationId", "buildingId");
CREATE INDEX "ManagementPlan_reviewDueDate_idx" ON "ManagementPlan"("reviewDueDate");
