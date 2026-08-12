import { notFound, redirect } from "next/navigation";
import { getSession, assertBuildingAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { evaluateBuilding } from "@/lib/compliance";
import { AcmChip, ConditionChip } from "@/components/ui/primitives";
import { formatDate, formatQty } from "@/lib/utils";
import { PrintButton } from "@/components/forms/print-button";

export const dynamic = "force-dynamic";

export default async function BuildingPrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect("/login");
  const b = await db.building.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { client: true, facility: true, inventoryItems: true },
  });
  if (!b || !assertBuildingAccess(user, b)) notFound();
  const c = await evaluateBuilding(b.id);

  return (
    <div className="mx-auto max-w-4xl bg-white p-8">
      <div className="no-print mb-4"><PrintButton /></div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-teal">STRATA · Building summary</div>
      <h1 className="font-display text-3xl font-semibold">{b.buildingNumber} · {b.name}</h1>
      <p className="text-sm text-ink-3">{b.client.name} · {b.facility.name} · {b.address}</p>
      <p className="mt-2 text-sm">Operational status: {c.status}. {c.reasons.join("; ")}</p>
      <p className="text-sm">Last inspection {formatDate(b.lastInspectionAt)} · Next {formatDate(b.nextInspectionAt)}</p>
      <table className="data mt-6">
        <thead><tr><th>ID</th><th>Material</th><th>Loc</th><th>Class</th><th>Cond</th><th>Qty</th></tr></thead>
        <tbody>
          {b.inventoryItems.map((i) => (
            <tr key={i.id}>
              <td className="mono-id">{i.inventoryCode}</td>
              <td>{i.materialDescription}</td>
              <td>{i.floor} {i.room}</td>
              <td><AcmChip value={i.acmClassification} /></td>
              <td><ConditionChip value={i.condition} /></td>
              <td>{formatQty(i.currentQuantity, i.quantityUnit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
