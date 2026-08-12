-- The Item # is a human-facing sequence within a building (for example, 01).
-- The Internal Item # retains the building-qualified reference and is unique
-- within an organization (for example, Larkin-200-01).
DROP INDEX "InventoryItem_organizationId_inventoryCode_key";
CREATE UNIQUE INDEX "InventoryItem_organizationId_internalCode_key"
  ON "InventoryItem"("organizationId", "internalCode");
