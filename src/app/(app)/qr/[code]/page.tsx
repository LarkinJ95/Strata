import { notFound, redirect } from "next/navigation";
import { getSession, assertBuildingAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { InventoryTable } from "@/components/records";

export const dynamic = "force-dynamic";

export default async function QrPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await getSession();
  if (!user) redirect("/login");
  const building = await db.building.findFirst({
    where: { organizationId: user.organizationId, qrCode: decodeURIComponent(code) },
    include: { inventoryItems: { include: { building: true } }, client: true },
  });
  if (!building || !assertBuildingAccess(user, building)) notFound();

  return (
    <div>
      <PageHeader kicker="QR access" title={building.name} description={`Scanned code ${building.qrCode}. Permissions still apply.`} />
      <Panel className="overflow-hidden">
        <InventoryTable rows={building.inventoryItems} showBuilding={false} />
      </Panel>
    </div>
  );
}
