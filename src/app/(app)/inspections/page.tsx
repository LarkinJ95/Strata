import Link from "next/link";
import { redirect } from "next/navigation";
import { buildingWhere, getSession } from "@/lib/auth";
import { inspectorWorkspace } from "@/lib/queries";
import { db } from "@/lib/db";
import { dataScope } from "@/lib/auth";
import { Chip, PageHeader, Panel, SectionTitle } from "@/components/ui/primitives";
import { formatDate, INSPECTION_TYPES } from "@/lib/utils";
import { AddInspectionControl } from "@/components/forms/actions-ui";

export const dynamic = "force-dynamic";

export default async function InspectionsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  const mine = user.isClient ? null : await inspectorWorkspace(user);
  const [all, buildings] = await Promise.all([
    db.inspection.findMany({
      where: dataScope(user),
      include: { building: { include: { client: true } }, inspector: true },
      orderBy: { scheduledDate: "desc" },
      take: 40,
    }),
    user.isClient ? Promise.resolve([]) : db.building.findMany({
      where: buildingWhere(user),
      include: { client: true, facility: true },
      orderBy: [{ client: { name: "asc" } }, { facility: { name: "asc" } }, { buildingNumber: "asc" }],
    }),
  ]);

  return (
    <div>
      <PageHeader
        kicker="Field program"
        title={user.isClient ? "Inspections" : "My inspections"}
        description="Resume drafts, finish verification, and keep the surveillance calendar current."
        actions={!user.isClient && <AddInspectionControl buildings={buildings} />}
      />

      {mine && (
        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Panel className="p-5">
            <SectionTitle>Today</SectionTitle>
            {mine.today.map((i) => (
              <Link key={i.id} href={`/inspections/${i.id}/field`} className="mb-2 block">
                <div className="font-medium">{i.building.name}</div>
                <div className="text-xs text-ink-3">{i.building.client.name} · {INSPECTION_TYPES[i.inspectionType] || i.inspectionType}</div>
              </Link>
            ))}
            {!mine.today.length && <p className="text-sm text-ink-3">Nothing scheduled today. Open a building to start.</p>}
          </Panel>
          <Panel className="p-5">
            <SectionTitle>Drafts / in progress</SectionTitle>
            {mine.drafts.map((i) => (
              <Link key={i.id} href={`/inspections/${i.id}/field`} className="mb-2 block">
                <div className="font-medium">{i.building.name}</div>
                <div className="text-xs text-ink-3">{i.completionPct}% complete</div>
              </Link>
            ))}
            {!mine.drafts.length && <p className="text-sm text-ink-3">No drafts.</p>}
          </Panel>
          <Panel className="p-5">
            <SectionTitle>Awaiting verification</SectionTitle>
            {mine.verify.map((r) => (
              <Link key={r.id} href={`/repairs/${r.id}`} className="mb-2 block">
                <div className="font-medium">{r.repairCode}</div>
                <div className="text-xs text-ink-3">{r.building.name} · {r.inventoryItem.inventoryCode}</div>
              </Link>
            ))}
            {!mine.verify.length && <p className="text-sm text-ink-3">None.</p>}
          </Panel>
        </div>
      )}

      <Panel className="overflow-hidden">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Date</th><th>Building</th><th>Type</th><th>Inspector</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {all.map((i) => (
                <tr key={i.id}>
                  <td>{formatDate(i.scheduledDate)}</td>
                  <td>{i.building.buildingNumber} · {i.building.name}</td>
                  <td className="capitalize">{i.inspectionType.replaceAll("_", " ")}</td>
                  <td>{i.inspector?.name}</td>
                  <td><Chip tone={i.status === "completed" ? "ok" : i.status === "in_progress" ? "ice" : "warn"}>{i.status.replaceAll("_", " ")}</Chip></td>
                  <td>
                    <Link href={i.status === "in_progress" || i.status === "draft" ? `/inspections/${i.id}/field` : `/inspections/${i.id}`} className="text-sm text-teal-dim">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
