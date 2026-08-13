import Link from "next/link";
import { redirect } from "next/navigation";
import { dataScope, getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Panel, SectionTitle } from "@/components/ui/primitives";
import { BulkFunctionalAreaCorrection } from "@/components/forms/bulk-functional-area-correction";

export const dynamic = "force-dynamic";

export default async function DataQualityPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.isClient) redirect("/portal");
  const scope = dataScope(user);
  const [unassignedFa, missingFloor, unlinkedSamples, duplicateCodes, areas, floors] = await Promise.all([
    db.inventoryItem.findMany({ where: { ...scope, functionalAreaId: null }, include: { building: true }, take: 200, orderBy: { updatedAt: "desc" } }),
    db.inventoryItem.findMany({ where: { ...scope, floor: null }, include: { building: true }, take: 200, orderBy: { updatedAt: "desc" } }),
    db.sample.findMany({ where: { ...scope, inventoryLinks: { none: {} } }, include: { building: true }, take: 200, orderBy: { collectionDate: "desc" } }),
    db.inventoryItem.groupBy({ by: ["organizationId", "internalCode"], where: { ...scope, internalCode: { not: null } }, _count: { _all: true }, having: { internalCode: { _count: { gt: 1 } } }, orderBy: { internalCode: "asc" }, take: 50 }),
    db.buildingArea.findMany({ where: { building: { organizationId: user.organizationId } }, orderBy: { name: "asc" } }),
    db.buildingFloor.findMany({ where: { building: { organizationId: user.organizationId } }, select: { id: true, name: true } }),
  ]);
  const floorNameById = new Map(floors.map((floor) => [floor.id, floor.name]));
  const areasWithFloors = areas.map((area) => ({ ...area, floor: area.floorId ? { name: floorNameById.get(area.floorId) ?? "Unassigned floor" } : null }));
  const Block = ({ title, count, children, href }: { title: string; count: number; children: React.ReactNode; href?: string }) => <Panel className="p-5"><SectionTitle action={<span className="chip chip-ice">{count}</span>}>{title}</SectionTitle>{count ? <div className="space-y-2">{children}</div> : <p className="text-sm text-ink-3">All clear.</p>}{count > 6 && href && <Link href={href} className="mt-3 block text-xs text-teal-dim hover:underline">View all {count}</Link>}</Panel>;
  return <div>
    <PageHeader kicker="Import and record controls" title="Data quality" description="Fix unassigned locations, incomplete links, and duplicate reference values before they become field-work issues." />
    <div className="grid gap-4 xl:grid-cols-2">
      <Block title="Bulk functional-area correction" count={unassignedFa.length}><BulkFunctionalAreaCorrection items={unassignedFa} areas={areasWithFloors} /></Block>
      <Block title="Inventory without a functional area" count={unassignedFa.length} href="/inventory">
        {unassignedFa.slice(0, 6).map((item) => <Link key={item.id} href={`/inventory/${item.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-paper-2"><b>{item.inventoryCode}</b> · {item.materialDescription}<span className="ml-2 text-xs text-ink-3">{item.building.buildingNumber}</span></Link>)}
      </Block>
      <Block title="Inventory without a floor" count={missingFloor.length} href="/inventory">
        {missingFloor.slice(0, 6).map((item) => <Link key={item.id} href={`/inventory/${item.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-paper-2"><b>{item.inventoryCode}</b> · {item.materialDescription}<span className="ml-2 text-xs text-ink-3">{item.building.buildingNumber}</span></Link>)}
      </Block>
      <Block title="Samples not linked to inventory" count={unlinkedSamples.length} href="/samples">
        {unlinkedSamples.slice(0, 6).map((sample) => <Link key={sample.id} href={`/samples/${sample.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-paper-2"><b>{sample.sampleNumber}</b> · {sample.material}<span className="ml-2 text-xs text-ink-3">{sample.building.buildingNumber}</span></Link>)}
      </Block>
      <Block title="Duplicate internal inventory IDs" count={duplicateCodes.length} href="/inventory">
        {duplicateCodes.slice(0, 6).map((row) => <div key={row.internalCode} className="rounded-lg px-2 py-1.5"><b>{row.internalCode}</b> · {row._count._all} records</div>)}
      </Block>
    </div>
  </div>;
}
