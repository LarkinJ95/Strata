import { notFound, redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { FieldInspection } from "@/components/forms/field-inspection";
import { photoPolicyMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

type FieldItemRow = {
  id: string;
  inventoryId: string;
  code: string;
  material: string;
  floor: string | null;
  room: string | null;
  location: string | null;
  qty: number | null;
  unit: string;
  acm: string;
  previousCondition: string | null;
  currentCondition: string | null;
  previousLabel: string | null;
  currentLabel: string | null;
  notes: string | null;
  quantityObserved: number | null;
  materialRemoved: boolean | number;
  removedQuantity: number | null;
  inspected: boolean | number;
  photo: string | null;
};

export default async function FieldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect("/login");
  const insp = await db.inspection.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      building: { include: { client: true } },
    },
  });
  if (!insp) notFound();

  // Do not use nested Prisma relation includes here. A large building can have
  // more than D1's safe number of relation parameters, which made field mode
  // fail after the inspection was successfully created.
  const items = await db.$queryRaw<FieldItemRow[]>(Prisma.sql`
    SELECT
      ii."id" AS "id",
      ii."inventoryItemId" AS "inventoryId",
      ii."previousCondition" AS "previousCondition",
      ii."currentCondition" AS "currentCondition",
      ii."previousLabel" AS "previousLabel",
      ii."currentLabel" AS "currentLabel",
      ii."notes" AS "notes",
      ii."quantityObserved" AS "quantityObserved",
      ii."materialRemoved" AS "materialRemoved",
      ii."removedQuantity" AS "removedQuantity",
      ii."inspected" AS "inspected",
      inv."inventoryCode" AS "code",
      inv."materialDescription" AS "material",
      inv."floor" AS "floor",
      inv."room" AS "room",
      inv."specificLocation" AS "location",
      inv."currentQuantity" AS "qty",
      inv."quantityUnit" AS "unit",
      inv."acmClassification" AS "acm",
      (
        SELECT photo."storageKey"
        FROM "PhotoLink" link
        INNER JOIN "Photo" photo ON photo."id" = link."photoId"
        WHERE link."inventoryItemId" = inv."id" AND link."primaryPhoto" = 1
        ORDER BY photo."uploadedAt" DESC
        LIMIT 1
      ) AS "photo"
    FROM "InspectionItem" ii
    INNER JOIN "InventoryItem" inv ON inv."id" = ii."inventoryItemId"
    WHERE ii."inspectionId" = ${id}
    ORDER BY ii."id" ASC
  `);

  return (
    <FieldInspection
      inspectionId={insp.id}
      building={{
        id: insp.building.id,
        name: insp.building.name,
        number: insp.building.buildingNumber,
        photoPolicy: insp.building.photoPolicy,
        photoMessage: photoPolicyMessage(insp.building.photoPolicy),
        client: insp.building.client.name,
      }}
      completion={insp.completionPct}
      items={items.map((item) => ({ ...item, materialRemoved: Boolean(item.materialRemoved), inspected: Boolean(item.inspected) }))}
    />
  );
}
