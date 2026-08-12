import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { FieldInspection } from "@/components/forms/field-inspection";
import { photoPolicyMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FieldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect("/login");
  const insp = await db.inspection.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      building: { include: { client: true } },
      items: { include: { inventoryItem: { include: { photoLinks: { where: { primaryPhoto: true }, include: { photo: true } } } } }, orderBy: { id: "asc" } },
    },
  });
  if (!insp) notFound();

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
      items={insp.items.map((it) => ({
        id: it.id,
        inventoryId: it.inventoryItemId,
        code: it.inventoryItem.inventoryCode,
        material: it.inventoryItem.materialDescription,
        floor: it.inventoryItem.floor,
        room: it.inventoryItem.room,
        location: it.inventoryItem.specificLocation,
        qty: it.inventoryItem.currentQuantity,
        unit: it.inventoryItem.quantityUnit,
        acm: it.inventoryItem.acmClassification,
        previousCondition: it.previousCondition,
        currentCondition: it.currentCondition,
        previousLabel: it.previousLabel,
        currentLabel: it.currentLabel,
        notes: it.notes,
        inspected: it.inspected,
        photo: it.inventoryItem.photoLinks[0]?.photo.storageKey ?? null,
      }))}
    />
  );
}
