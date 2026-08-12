import { notFound, redirect } from "next/navigation";
import { getSession, assertBuildingAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Panel } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function PacketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect("/login");
  const b = await db.building.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      client: true,
      inventoryItems: { where: { recordStatus: "active" } },
      floorPlans: true,
    },
  });
  if (!b || !assertBuildingAccess(user, b)) notFound();

  return (
    <div>
      <PageHeader
        kicker="Field packet"
        title={`${b.buildingNumber} inspection packet`}
        description="A branded PDF — inventory field forms, signature block, and every floor plan on file for this building."
      />
      <Panel className="p-6">
        <div className="text-sm text-ink-2">
          {b.client.name} · {b.inventoryItems.length} active materials · {b.floorPlans.length} floor plan{b.floorPlans.length === 1 ? "" : "s"}
        </div>
        <ul className="mt-3 text-sm text-ink-3">
          {b.floorPlans.map((fp) => (
            <li key={fp.id}>· {fp.name}</li>
          ))}
          {!b.floorPlans.length && <li>No drawings uploaded yet — the packet will still include inventory forms.</li>}
        </ul>
        <a href={`/api/buildings/${b.id}/packet`} className="btn btn-primary mt-5" target="_blank" rel="noreferrer">
          Open PDF packet
        </a>
      </Panel>
    </div>
  );
}
