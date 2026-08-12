import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, buildingWhere } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Panel, Chip } from "@/components/ui/primitives";
import { parseJson } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BuildingsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  const buildings = await db.building.findMany({
    where: buildingWhere(user),
    include: {
      _count: { select: { inventoryItems: true, repairs: true, samples: true } },
    },
    orderBy: [{ clientId: "asc" }, { buildingNumber: "asc" }],
  });

  return (
    <div>
      <PageHeader kicker="Portfolio" title="Buildings" description="Every building carries its own asbestos program status." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {buildings.map((b) => {
          const reasons = parseJson<string[]>(b.complianceReasons, []);
          const tone = b.complianceStatus === "current" ? "ok" : b.complianceStatus === "attention" ? "warn" : "danger";
          return (
            <Link key={b.id} href={`/buildings/${b.id}`}>
              <Panel className="h-full p-5 transition hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="mono-id text-[11px] text-teal-dim">{b.buildingNumber}</div>
                    <div className="font-display text-lg font-semibold">{b.name}</div>
                  </div>
                  <Chip tone={tone}>{b.complianceStatus === "current" ? "Current" : b.complianceStatus === "attention" ? "Attention" : "Action"}</Chip>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-paper-2 py-2"><div className="font-semibold">{b._count.inventoryItems}</div>inventory</div>
                  <div className="rounded-lg bg-paper-2 py-2"><div className="font-semibold">{b._count.repairs}</div>repairs</div>
                  <div className="rounded-lg bg-paper-2 py-2"><div className="font-semibold">{b._count.samples}</div>samples</div>
                </div>
                <ul className="mt-3 text-xs text-ink-3">
                  {reasons.slice(0, 3).map((r) => <li key={r}>· {r}</li>)}
                </ul>
                {b.photoPolicy === "prohibited" && (
                  <div className="mt-3 rounded-lg bg-[#fdecec] px-2 py-1 text-[11px] font-semibold text-[#b42318]">
                    Photography not permitted
                  </div>
                )}
              </Panel>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
