import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { PrintButton } from "@/components/forms/print-button";

export const dynamic = "force-dynamic";

export default async function InspectionPrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect("/login");
  const insp = await db.inspection.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      building: { include: { client: true } },
      inspector: true,
      items: { include: { inventoryItem: true } },
      signatures: true,
    },
  });
  if (!insp) notFound();

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
          {insp.items.map((it) => (
            <tr key={it.id}>
              <td className="mono-id">{it.inventoryItem.inventoryCode}</td>
              <td>{it.inventoryItem.materialDescription}</td>
              <td>{it.inventoryItem.floor}</td>
              <td>{it.inventoryItem.room}</td>
              <td>{it.inventoryItem.currentQuantity} {it.inventoryItem.quantityUnit}</td>
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
