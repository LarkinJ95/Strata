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
  const unassignedRows = await db.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "InventoryItem" WHERE "organizationId" = ? AND "functionalAreaId" IS NULL LIMIT 200', user.organizationId);
  const [unassignedFa, missingFloor, unlinkedSamples, duplicateCodes, areas] = await Promise.all([
    db.inventoryItem.findMany({ where: { ...scope, id: { in: unassignedRows.map((row) => row.id) } }, include: { building: true }, take: 200, orderBy: { updatedAt: "desc" } }),
    db.inventoryItem.findMany({ where: { ...scope, floor: null }, include: { building: true }, take: 200, orderBy: { updatedAt: "desc" } }),
    db.sample.findMany({ where: { ...scope, inventoryLinks: { none: {} } }, include: { building: true }, take: 200, orderBy: { collectionDate: "desc" } }),
    db.inventoryItem.groupBy({ by: ["organizationId", "internalCode"], where: { ...scope, internalCode: { not: null } }, _count: { _all: true }, having: { internalCode: { _count: { gt: 1 } } }, take: 50 }),
    db.buildingArea.findMany({ where: { building: { organizationId: user.organizationId } }, include: { floor: { select: { name: true } } }, orderBy: { name: "asc" } }),
  ]);
  const Block = ({ title, children }: { title: string; children: React.ReactNode }) => <Panel className="p-5"><SectionTitle>{title}</SectionTitle><div className="space-y-2">{children}</div></Panel>;
  return <div>
    <PageHeader kicker="Import and record controls" title="Data quality" description="Fix unassigned locations, incomplete links, and duplicate reference values before they become field-work issues." />
    <div className="grid gap-4 xl:grid-cols-2">
      <Block title="Bulk functional-area correction"><BulkFunctionalAreaCorrection items={unassignedFa} areas={areas} /></Block>
      <Block title={`Inventory without a functional area (${unassignedFa.length})`}>
        {unassignedFa.map((item) => <Link key={item.id} href={`/inventory/${item.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-paper-2"><b>{item.inventoryCode}</b> · {item.materialDescription}<span className="ml-2 text-xs text-ink-3">{item.building.buildingNumber}</span></Link>)}
        {!unassignedFa.length && <p className="text-sm text-ink-3">None.</p>}
      </Block>
      <Block title={`Inventory without a floor (${missingFloor.length})`}>
        {missingFloor.map((item) => <Link key={item.id} href={`/inventory/${item.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-paper-2"><b>{item.inventoryCode}</b> · {item.materialDescription}<span className="ml-2 text-xs text-ink-3">{item.building.buildingNumber}</span></Link>)}
        {!missingFloor.length && <p className="text-sm text-ink-3">None.</p>}
      </Block>
      <Block title={`Samples not linked to inventory (${unlinkedSamples.length})`}>
        {unlinkedSamples.map((sample) => <Link key={sample.id} href={`/samples/${sample.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-paper-2"><b>{sample.sampleNumber}</b> · {sample.material}<span className="ml-2 text-xs text-ink-3">{sample.building.buildingNumber}</span></Link>)}
        {!unlinkedSamples.length && <p className="text-sm text-ink-3">None.</p>}
      </Block>
      <Block title={`Duplicate internal inventory IDs (${duplicateCodes.length})`}>
        {duplicateCodes.map((row) => <div key={row.internalCode} className="rounded-lg px-2 py-1.5"><b>{row.internalCode}</b> · {row._count._all} records</div>)}
        {!duplicateCodes.length && <p className="text-sm text-ink-3">None.</p>}
      </Block>
    </div>
  </div>;
}
