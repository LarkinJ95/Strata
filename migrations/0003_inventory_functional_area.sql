ALTER TABLE "InventoryItem" ADD COLUMN "functionalAreaId" TEXT;
CREATE INDEX "InventoryItem_functionalAreaId_idx" ON "InventoryItem"("functionalAreaId");

UPDATE "InventoryItem"
SET "functionalAreaId" = (
  SELECT "BuildingArea"."id"
  FROM "BuildingArea"
  WHERE "BuildingArea"."buildingId" = "InventoryItem"."buildingId"
    AND (lower("BuildingArea"."faCode") = lower("InventoryItem"."area") OR lower("BuildingArea"."name") = lower("InventoryItem"."area"))
  LIMIT 1
)
WHERE "area" IS NOT NULL;

CREATE UNIQUE INDEX "FloorPlanMarker_floorPlanId_recordType_recordId_key" ON "FloorPlanMarker"("floorPlanId", "recordType", "recordId");
