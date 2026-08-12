import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { formatDate, formatQty } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RemovalsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  const rows = await db.removalEvent.findMany({
    where: { organizationId: user.organizationId, ...(user.clientId ? { building: { clientId: user.clientId } } : {}) },
    include: { building: true, inventoryItem: true, contractor: true },
    orderBy: { removedAt: "desc" },
  });

  return (
    <div>
      <PageHeader kicker="Abatement" title="Removal events" description="Inventory records are never deleted. Partial and complete removals become history." />
      <Panel className="overflow-hidden">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Date</th><th>Building</th><th>Material</th><th>Removed</th><th>Remaining</th><th>Project</th><th>WSR</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.removedAt)}</td>
                  <td>{r.building.buildingNumber}</td>
                  <td><Link href={`/inventory/${r.inventoryItemId}`} className="mono-id text-teal-dim">{r.inventoryItem.inventoryCode}</Link></td>
                  <td>{formatQty(r.quantityRemoved, r.unit)}</td>
                  <td>{formatQty(r.quantityRemaining, r.unit)}</td>
                  <td>{r.projectNumber}</td>
                  <td>{r.wasteShipment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
