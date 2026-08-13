import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { can, getSession, assertBuildingAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { fileUrl } from "@/lib/files";
import { FloorPlanUpload } from "@/components/forms/floor-plan-upload";
import { AccessField } from "@/components/forms/access-field";
import { ConfirmDeleteButton } from "@/components/forms/confirm-delete-button";
import { deleteFloorPlan } from "@/actions/records";
import { FloorPlanMapper } from "@/components/forms/floor-plan-mapper";

export const dynamic = "force-dynamic";

export default async function PlansPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect("/login");
  const building = await db.building.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { floors: { orderBy: { level: "asc" } }, floorPlans: { include: { markers: true } }, inventoryItems: true },
  });
  if (!building || !assertBuildingAccess(user, building)) notFound();

  return (
    <div>
      <PageHeader
        kicker={building.buildingNumber}
        title="Floor plans"
        description="Pins are future-ready for inventory, samples, and repairs. Geometry is stored separately from the drawing file."
        actions={<Link href={`/buildings/${building.id}`} className="btn btn-ghost">Back</Link>}
      />
      <div className="space-y-6">
        {can(user, "documents.upload") && (
          <Panel className="p-5">
            <div className="mb-3 font-display font-semibold">Upload floor plan</div>
            <FloorPlanUpload buildingId={building.id} floors={building.floors} />
          </Panel>
        )}
        {building.floorPlans.map((fp) => (
          <Panel key={fp.id} className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="font-display font-semibold">{fp.name}</div>
              {!user.isClient && (
                <form action={deleteFloorPlan}>
                  <AccessField />
                  <input type="hidden" name="id" value={fp.id} />
                  <ConfirmDeleteButton label="Delete floor plan" message="Delete this floor plan and all its map pins? This cannot be undone." />
                </form>
              )}
            </div>
            <div className="relative overflow-hidden rounded-xl border border-[rgba(16,36,72,0.08)] bg-paper-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl(fp.storageKey)} alt={fp.name} className="w-full" />
              {fp.markers.map((m) => {
                const item = building.inventoryItems.find((i) => i.id === m.recordId);
                return (
                  <Link
                    key={m.id}
                    href={item ? `/inventory/${item.id}` : "#"}
                    className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal shadow-glow"
                    style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}
                    title={m.label || ""}
                  />
                );
              })}
            </div>
            {!user.isClient && <div className="mt-4"><FloorPlanMapper plan={fp} items={building.inventoryItems} /></div>}
          </Panel>
        ))}
        {!building.floorPlans.length && <p className="text-ink-3">No drawings uploaded.</p>}
      </div>
    </div>
  );
}
