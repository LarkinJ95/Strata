import { notFound, redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { PrintButton } from "@/components/forms/print-button";

export const dynamic = "force-dynamic";

type PrintItemRow = {
  id: string;
  previousCondition: string | null;
  currentCondition: string | null;
  previousLabel: string | null;
  currentLabel: string | null;
  notes: string | null;
  inventoryCode: string;
  materialDescription: string;
  floor: string | null;
  room: string | null;
  currentQuantity: number | null;
  quantityUnit: string;
};

export default async function InspectionPrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect("/login");
  const insp = await db.inspection.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      building: { include: { client: true } },
      inspector: true,
      signatures: true,
    },
  });
  if (!insp) notFound();
  const items = await db.$queryRaw<PrintItemRow[]>(Prisma.sql`
    SELECT
      ii."id" AS "id",
      ii."previousCondition" AS "previousCondition",
      ii."currentCondition" AS "currentCondition",
      ii."previousLabel" AS "previousLabel",
      ii."currentLabel" AS "currentLabel",
      ii."notes" AS "notes",
      inv."inventoryCode" AS "inventoryCode",
      inv."materialDescription" AS "materialDescription",
      inv."floor" AS "floor",
      inv."room" AS "room",
      inv."currentQuantity" AS "currentQuantity",
      inv."quantityUnit" AS "quantityUnit"
    FROM "InspectionItem" ii
    INNER JOIN "InventoryItem" inv ON inv."id" = ii."inventoryItemId"
    WHERE ii."inspectionId" = ${id}
    ORDER BY ii."id" ASC
  `);

  return (
    <div className="mx-auto max-w-4xl bg-white p-8">
      <div className="no-print mb-4"><PrintButton label="Print inspection packet" /></div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-teal">STRATA · Inspection form</div>
      <h1 className="font-display text-3xl font-semibold">{insp.building.name}</h1>
      <p className="text-sm">{insp.building.client.name} · {insp.building.buildingNumber} · {insp.inspectionType.replaceAll("_", " ")}</p>
      <p className="text-sm">Inspection date {formatDate(insp.scheduledDate)} · Inspector {insp.inspector?.name}</p>
      <table className="data mt-6">
        <thead>
          <tr>
            <th>ID</th><th>Material</th><th>Floor</th><th>Room</th><th>Qty</th>
            <th>Prev. cond.</th><th>Current cond.</th><th>Prev. label</th><th>Label</th><th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td className="mono-id">{it.inventoryCode}</td>
              <td>{it.materialDescription}</td>
              <td>{it.floor}</td>
              <td>{it.room}</td>
              <td>{it.currentQuantity} {it.quantityUnit}</td>
              <td>{it.previousCondition}</td>
              <td className="min-w-24">{it.currentCondition || "☐ Good  ☐ Needs repair  ☐ Removed  ☐ Inaccessible"}</td>
              <td>{it.previousLabel}</td>
              <td>{it.currentLabel || "☐ Good  ☐ Replaced  ☐ Missing"}</td>
              <td>{it.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-8 grid gap-6 text-sm md:grid-cols-2">
        <div>
          <div className="font-semibold">New materials / samples / recommendations</div>
          <div className="mt-2 h-24 border border-dashed border-[rgba(16,36,72,0.2)]" />
        </div>
        <div>
          <div className="font-semibold">Signature</div>
          <p className="mt-2">{insp.signatures[0]?.signerName || "___________________________"}</p>
          <p>Date {formatDate(insp.signedAt || insp.scheduledDate)}</p>
        </div>
      </div>
    </div>
  );
}
