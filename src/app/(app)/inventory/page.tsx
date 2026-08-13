import { redirect } from "next/navigation";
import { getSession, buildingWhere, dataScope } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { InventoryTable } from "@/components/records";
import { InventoryFilters } from "@/components/forms/inventory-filters";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const where: Record<string, unknown> = { ...dataScope(user) };
  if (sp.building) where.buildingId = sp.building;
  if (sp.functionalArea) where.functionalAreaId = sp.functionalArea;
  if (sp.acm) where.acmClassification = sp.acm.includes(",") ? { in: sp.acm.split(",") } : sp.acm;
  if (sp.condition) where.condition = sp.condition.includes(",") ? { in: sp.condition.split(",") } : sp.condition;
  if (sp.q) {
    where.OR = [
      { inventoryCode: { contains: sp.q } },
      { materialDescription: { contains: sp.q } },
      { room: { contains: sp.q } },
    ];
  }
  if (sp.view === "unsampled") where.AND = [{ OR: [{ acmClassification: "unknown" }, { sampleLinks: { none: {} } }] }];
  if (sp.view === "no-photo") {
    where.acmClassification = { in: ["confirmed_acm", "assumed_acm", "pacm"] };
    where.photoLinks = { none: {} };
  }
  if (sp.view === "tsi") where.materialCategory = "Thermal System Insulation";
  if (sp.view === "removed") where.recordStatus = "removed";

  const requestedPer = Number(sp.per);
  const per = [25, 50, 100].includes(requestedPer) ? requestedPer : 50;
  const page = Math.max(1, Number(sp.page) || 1);
  const total = await db.inventoryItem.count({ where });
  const lastPage = Math.max(1, Math.ceil(total / per));
  const currentPage = Math.min(page, lastPage);
  const [rows, buildings] = await Promise.all([
    db.inventoryItem.findMany({
      where,
      include: { building: true, functionalArea: { select: { id: true, name: true, faCode: true } }, photoLinks: { select: { id: true } }, inspectionItems: { where: { inspected: true, inspection: { status: "completed" } }, orderBy: { inspectedAt: "desc" }, take: 1, include: { inspection: { select: { inspector: { select: { name: true } } } } } } },
      orderBy: sp.sort === "quantity" ? { currentQuantity: "desc" } : sp.sort === "building" ? { building: { buildingNumber: "asc" } } : { inventoryCode: "asc" },
      skip: (currentPage - 1) * per,
      take: per,
    }),
    db.building.findMany({ where: buildingWhere(user), orderBy: { buildingNumber: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        kicker="Digital asbestos records"
        title="Inventory"
        description="Every material retains its classification, remaining quantity, supporting samples, and condition history."
      />
      <InventoryFilters buildings={buildings} current={sp} total={total} />
      <Panel className="mt-4 overflow-hidden">
        <InventoryTable rows={rows} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(16,36,72,0.08)] px-4 py-3 text-sm text-ink-3">
          <span>Showing {total ? (currentPage - 1) * per + 1 : 0}–{Math.min(currentPage * per, total)} of {total} matching records</span>
          <div className="flex items-center gap-2">
            <span className="text-xs">Per page {([25, 50, 100] as const).map((size) => <a key={size} className={`ml-1 ${size === per ? "font-semibold text-teal-dim" : "hover:underline"}`} href={`/inventory?${new URLSearchParams({ ...sp, per: String(size), page: "1" }).toString()}`}>{size}</a>)}</span>
            {currentPage > 1 && <a className="btn btn-ghost text-xs" href={`/inventory?${new URLSearchParams({ ...sp, page: String(currentPage - 1) }).toString()}`}>Previous</a>}
            <span className="mono-id text-xs">Page {currentPage} / {lastPage}</span>
            {currentPage < lastPage && <a className="btn btn-ghost text-xs" href={`/inventory?${new URLSearchParams({ ...sp, page: String(currentPage + 1) }).toString()}`}>Next</a>}
          </div>
        </div>
      </Panel>
    </div>
  );
}
