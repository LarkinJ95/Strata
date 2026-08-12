import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, buildingWhere, dataScope } from "@/lib/auth";
import { db } from "@/lib/db";
import { Chip, Kpi, PageHeader, Panel, SectionTitle } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!user.isClient) {
    // staff may preview portal for their org but default dashboard is staff
  }
  const scope = dataScope(user);
  const buildings = await db.building.findMany({
    where: scope,
    include: { facility: true, client: true, _count: { select: { inventoryItems: true, repairs: true } } },
    orderBy: { buildingNumber: "asc" },
  });
  const facilities = await db.facility.findMany({
    where: { organizationId: user.organizationId, ...(user.clientId ? { clientId: user.clientId } : {}) },
    include: { _count: { select: { buildings: true } } },
    orderBy: { name: "asc" },
  });
  const openRepairs = await db.repair.count({
    where: { ...scope, status: { notIn: ["closed", "cancelled"] } },
  });

  return (
    <div>
      <PageHeader
        kicker="Client portal"
        title={user.clientName || "Portfolio"}
        description="You are viewing only records authorized for your organization. Internal photographs and working files are withheld."
      />
      <div className="grid gap-3 md:grid-cols-3">
        <Kpi label="Buildings" value={buildings.length} />
        <Kpi label="Open repairs" value={openRepairs} />
        <Kpi label="Signed-in as" value={user.roleName} />
      </div>
      <section className="mt-5">
        <SectionTitle>Assigned facilities</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {facilities.map((facility) => <Panel key={facility.id} className="p-4"><div className="mono-id text-[11px] text-teal-dim">{facility.facilityId}</div><div className="font-display text-base font-semibold">{facility.name}</div><div className="mt-1 text-xs text-ink-3">{facility.address || [facility.city, facility.state].filter(Boolean).join(", ") || "Address not recorded"}</div><div className="mt-2 text-xs text-ink-3">{facility._count.buildings} buildings</div></Panel>)}
        </div>
      </section>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {buildings.map((b) => (
          <Link key={b.id} href={`/buildings/${b.id}`}>
            <Panel className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="mono-id text-[11px] text-teal-dim">{b.buildingNumber}</div>
                  <div className="font-display text-lg font-semibold">{b.name}</div>
                  <div className="text-xs text-ink-3">{b.facility.name}</div>
                </div>
                <Chip tone={b.complianceStatus === "current" ? "ok" : b.complianceStatus === "attention" ? "warn" : "danger"}>
                  {b.complianceStatus}
                </Chip>
              </div>
              <div className="mt-3 text-xs text-ink-3">Next inspection {formatDate(b.nextInspectionAt)} · {b._count.inventoryItems} materials</div>
            </Panel>
          </Link>
        ))}
      </div>
      <Panel className="mt-6 p-5">
        <SectionTitle>Downloads</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export/inventory" className="btn btn-ghost">Current inventory (XLSX)</a>
          <Link href="/reports/inventory" className="btn btn-ghost">Inventory PDF</Link>
          <Link href="/documents" className="btn btn-ghost">Authorized documents</Link>
        </div>
      </Panel>
    </div>
  );
}
