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
  if (sp.acm) where.acmClassification = sp.acm;
  if (sp.condition) where.condition = sp.condition;
  if (sp.q) {
    where.OR = [
      { inventoryCode: { contains: sp.q } },
      { materialDescription: { contains: sp.q } },
      { room: { contains: sp.q } },
    ];
  }
  if (sp.view === "damaged") {
    where.acmClassification = { in: ["confirmed_acm", "assumed_acm", "pacm"] };
    where.condition = { in: ["damaged", "significantly_damaged", "needs_repair"] };
  }
  if (sp.view === "tsi") where.materialCategory = "Thermal System Insulation";
  if (sp.view === "removed") where.recordStatus = "removed";

  const [rows, buildings] = await Promise.all([
    db.inventoryItem.findMany({
      where,
      include: { building: true },
      orderBy: { inventoryCode: "asc" },
      take: 200,
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
      <InventoryFilters buildings={buildings} current={sp} />
      <Panel className="mt-4 overflow-hidden">
        <InventoryTable rows={rows} />
      </Panel>
    </div>
  );
}
