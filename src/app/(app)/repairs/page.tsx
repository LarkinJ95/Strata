import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, dataScope } from "@/lib/auth";
import { db } from "@/lib/db";
import { Chip, PageHeader, Panel } from "@/components/ui/primitives";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RepairsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const where: Record<string, unknown> = { ...dataScope(user) };
  if (sp.building) where.buildingId = sp.building;
  if (sp.status) where.status = sp.status;
  const rows = await db.repair.findMany({
    where,
    include: { building: true, inventoryItem: true },
    orderBy: [{ status: "asc" }, { identifiedAt: "desc" }],
  });

  return (
    <div>
      <PageHeader kicker="Response actions" title="Repairs" description="Repairs do not close themselves. Contractor complete ≠ environmentally verified." />
      <Panel className="overflow-hidden">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Repair</th><th>Building</th><th>Material</th><th>Problem</th><th>Priority</th><th>Status</th><th>Due</th>{!user.isClient && <th>Est. cost</th>}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/repairs/${r.id}`} className="mono-id text-teal-dim">{r.repairCode}</Link></td>
                  <td>{r.building.buildingNumber}</td>
                  <td><Link href={`/inventory/${r.inventoryItemId}`}>{r.inventoryItem.inventoryCode}</Link></td>
                  <td className="max-w-xs truncate">{r.problem}</td>
                  <td className="capitalize">{r.priority}</td>
                  <td><Chip tone={r.status === "closed" ? "ok" : r.status === "awaiting_verification" ? "warn" : "danger"}>{r.status.replaceAll("_", " ")}</Chip></td>
                  <td>{formatDate(r.scheduledDate)}</td>
                  {!user.isClient && <td>{r.estimatedCost != null ? `$${formatNumber(r.estimatedCost)}` : "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
