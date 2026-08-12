import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { queueData } from "@/lib/queries";
import { PageHeader, Panel, SectionTitle, AcmChip, ConditionChip } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Block({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Panel className="p-5">
      <SectionTitle>
        <span>{title}</span>
        <span className="ml-2 chip chip-ice">{count}</span>
      </SectionTitle>
      <div className="space-y-2">{children}</div>
    </Panel>
  );
}

export default async function QueuePage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.isClient) redirect("/portal");
  const q = await queueData(user);

  return (
    <div>
      <PageHeader
        kicker="Daily operations"
        title="Compliance queue"
        description="Central list of inspections, damaged materials, laboratory work, and repairs that need a person today."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Block title="Overdue inspections" count={q.overdueInspections.length}>
          {q.overdueInspections.map((b) => (
            <Link key={b.id} href={`/buildings/${b.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-paper-2">
              <div className="font-medium">{b.buildingNumber} · {b.name}</div>
              <div className="text-xs text-ink-3">{b.client.name} · due {formatDate(b.nextInspectionAt)}</div>
            </Link>
          ))}
          {!q.overdueInspections.length && <p className="text-sm text-ink-3">None.</p>}
        </Block>
        <Block title="Upcoming inspections (30 days)" count={q.upcomingInspections.length}>
          {q.upcomingInspections.map((b) => (
            <Link key={b.id} href={`/buildings/${b.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-paper-2">
              <div className="font-medium">{b.buildingNumber} · {b.name}</div>
              <div className="text-xs text-ink-3">{formatDate(b.nextInspectionAt)}</div>
            </Link>
          ))}
          {!q.upcomingInspections.length && <p className="text-sm text-ink-3">None.</p>}
        </Block>
        <Block title="Damaged ACM / PACM" count={q.damaged.length}>
          {q.damaged.map((it) => (
            <Link key={it.id} href={`/inventory/${it.id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-paper-2">
              <div>
                <div className="font-medium">{it.inventoryCode} · {it.materialDescription}</div>
                <div className="text-xs text-ink-3">{it.building.name}</div>
              </div>
              <div className="flex gap-1"><AcmChip value={it.acmClassification} /><ConditionChip value={it.condition} /></div>
            </Link>
          ))}
        </Block>
        <Block title="New suspect / provisional" count={q.suspects.length}>
          {q.suspects.map((it) => (
            <Link key={it.id} href={`/inventory/${it.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-paper-2">
              <div className="font-medium">{it.inventoryCode} · {it.materialDescription}</div>
              <div className="text-xs text-ink-3">{it.building.name} · provisional</div>
            </Link>
          ))}
          {!q.suspects.length && <p className="text-sm text-ink-3">None.</p>}
        </Block>
        <Block title="Samples awaiting laboratory" count={q.pendingLab.length}>
          {q.pendingLab.map((s) => (
            <Link key={s.id} href={`/samples/${s.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-paper-2">
              <div className="mono-id text-teal-dim">{s.sampleNumber}</div>
              <div className="text-xs text-ink-3">{s.material} · {s.building.name} · {s.status}</div>
            </Link>
          ))}
        </Block>
        <Block title="Results awaiting reconciliation" count={q.unreconciled.length}>
          {q.unreconciled.map((s) => (
            <Link key={s.id} href="/samples/reconcile" className="block rounded-lg px-2 py-1.5 hover:bg-paper-2">
              <div className="mono-id text-teal-dim">{s.sampleNumber}</div>
              <div className="text-xs text-ink-3">{s.material} · {s.building.name}</div>
            </Link>
          ))}
        </Block>
        <Block title="Open repairs" count={q.openRepairs.length}>
          {q.openRepairs.map((r) => (
            <Link key={r.id} href={`/repairs/${r.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-paper-2">
              <div className="font-medium">{r.repairCode} · {r.problem}</div>
              <div className="text-xs text-ink-3">{r.building.name} · {r.priority} · {r.status}</div>
            </Link>
          ))}
        </Block>
        <Block title="Repairs awaiting verification" count={q.awaiting.length}>
          {q.awaiting.map((r) => (
            <Link key={r.id} href={`/repairs/${r.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-paper-2">
              <div className="font-medium">{r.repairCode}</div>
              <div className="text-xs text-ink-3">{r.inventoryItem.inventoryCode} · {r.building.name}</div>
            </Link>
          ))}
        </Block>
        <Block title="Incomplete inspections" count={q.drafts.length}>
          {q.drafts.map((i) => (
            <Link key={i.id} href={`/inspections/${i.id}/field`} className="block rounded-lg px-2 py-1.5 hover:bg-paper-2">
              <div className="font-medium">{i.building.name} · {i.inspectionType.replaceAll("_", " ")}</div>
              <div className="text-xs text-ink-3">{i.completionPct}% · {i.status}</div>
            </Link>
          ))}
        </Block>
        <Block title="Overdue repairs" count={q.overdueRepairs.length}>
          {q.overdueRepairs.map((r) => (
            <Link key={r.id} href={`/repairs/${r.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-paper-2">
              <div className="font-medium">{r.repairCode}</div>
              <div className="text-xs text-status-action">Scheduled {formatDate(r.scheduledDate)}</div>
            </Link>
          ))}
        </Block>
      </div>
    </div>
  );
}
