import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { dashboardData } from "@/lib/queries";
import { Kpi, PageHeader, Panel, SectionTitle } from "@/components/ui/primitives";
import { ActivityList } from "@/components/records";
import { AcmChip, ConditionChip } from "@/components/ui/primitives";
import { formatDate, formatQty } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.isClient) redirect("/portal");
  if (user.isContractor) redirect("/repairs");
  const data = await dashboardData(user);

  return (
    <div>
      <PageHeader
        kicker="Organization dashboard"
        title="What needs attention today"
        description="Operational queue across the Northline portfolio. Statuses are operational, not legal determinations."
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Overdue inspections" value={data.action.overdueInspections} tone={data.action.overdueInspections ? "danger" : "ok"} href="/queue" hint="Buildings past next-inspection date" delta="12-week inspection activity" series={data.trends.inspections} />
        <Kpi label="Damaged ACM" value={data.action.damagedAcm} tone={data.action.damagedAcm ? "danger" : "ok"} href="/queue" hint="Confirmed / assumed / PACM" delta="12-week material activity" series={data.trends.damaged} />
        <Kpi label="Overdue repairs" value={data.action.overdueRepairs} tone={data.action.overdueRepairs ? "danger" : "ok"} href="/repairs" delta="12-week repair activity" series={data.trends.repairs} />
        <Kpi label="Unreconciled results" value={data.action.unreconciled} tone={data.action.unreconciled ? "warn" : "ok"} href="/samples/reconcile" delta="12-week sample activity" series={data.trends.samples} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Kpi label="Clients" value={data.portfolio.clients} href="/clients" />
        <Kpi label="Buildings" value={data.portfolio.buildings} href="/buildings" />
        <Kpi label="Active inventory" value={data.portfolio.inventory} href="/inventory" />
        <Kpi label="Open repairs" value={data.portfolio.openRepairs} href="/repairs" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Panel className="p-5">
            <SectionTitle action={<Link href="/queue" className="text-sm text-teal-dim">Open queue</Link>}>
              Action required
            </SectionTitle>
            {data.overdueBuildingList.length === 0 && data.damagedItems.length === 0 ? (
              <p className="text-sm text-ink-3">No overdue inspections or damaged ACM in the current scope.</p>
            ) : (
              <div className="space-y-3">
                {data.overdueBuildingList.map((b) => (
                  <Link key={b.id} href={`/buildings/${b.id}`} className="flex items-center justify-between rounded-xl border border-[rgba(16,36,72,0.06)] px-3 py-2 hover:bg-teal-soft/40">
                    <div>
                      <div className="font-medium">{b.name}</div>
                      <div className="text-xs text-ink-3">{b.client.name} · {b.facility.name} · {b.buildingNumber}</div>
                    </div>
                    <span className="chip chip-danger">Overdue {formatDate(b.nextInspectionAt)}</span>
                  </Link>
                ))}
                {data.damagedItems.map((it) => (
                  <Link key={it.id} href={`/inventory/${it.id}`} className="flex items-center justify-between rounded-xl border border-[rgba(16,36,72,0.06)] px-3 py-2 hover:bg-teal-soft/40">
                    <div>
                      <div className="font-medium">{it.inventoryCode} · {it.materialDescription}</div>
                      <div className="text-xs text-ink-3">{it.building.name} · {it.floor} · {it.room}</div>
                    </div>
                    <div className="flex gap-1">
                      <AcmChip value={it.acmClassification} />
                      <ConditionChip value={it.condition} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel className="p-5">
            <SectionTitle>Upcoming inspections</SectionTitle>
            <div className="space-y-2">
              {data.upcomingInspections.map((b) => (
                <Link key={b.id} href={`/buildings/${b.id}`} className="flex items-center justify-between rounded-xl px-2 py-2 hover:bg-paper-2">
                  <div>
                    <div className="font-medium">{b.buildingNumber} · {b.name}</div>
                    <div className="text-xs text-ink-3">{b.client.name}</div>
                  </div>
                  <span className="chip chip-warn">{formatDate(b.nextInspectionAt)}</span>
                </Link>
              ))}
              {data.upcomingInspections.length === 0 && <p className="text-sm text-ink-3">None scheduled in the next 60 days.</p>}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel className="p-5">
            <SectionTitle>Recent activity</SectionTitle>
            <ActivityList items={data.recentActivity} />
          </Panel>
          <Panel className="p-5">
            <SectionTitle>Recent samples</SectionTitle>
            {data.recentSamples.map((s) => (
              <Link key={s.id} href={`/samples/${s.id}`} className="mb-2 block rounded-lg px-2 py-1.5 hover:bg-paper-2">
                <div className="mono-id text-sm text-teal-dim">{s.sampleNumber}</div>
                <div className="text-xs text-ink-3">{s.material} · {s.building.name} · {s.status}</div>
              </Link>
            ))}
          </Panel>
          <Panel className="p-5">
            <SectionTitle>Recent removals</SectionTitle>
            {data.recentRemovals.map((r) => (
              <div key={r.id} className="mb-2 text-sm">
                <div className="font-medium">{formatQty(r.quantityRemoved, r.unit)} removed</div>
                <div className="text-xs text-ink-3">{r.inventoryItem.inventoryCode} · {r.building.name} · {formatDate(r.removedAt)}</div>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  );
}
