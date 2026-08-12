import { redirect } from "next/navigation";
import { getSession, dataScope } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { ReconcileCard } from "@/components/forms/reconcile-card";
import { parseJson } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReconcilePage() {
  const user = await getSession();
  if (!user) redirect("/login");
  const samples = await db.sample.findMany({
    where: { ...dataScope(user), status: { in: ["results_received", "reviewed"] } },
    include: {
      building: true,
      layers: { include: { result: true } },
    },
    orderBy: { dateResultsReceived: "asc" },
  });
  const inventory = await db.inventoryItem.findMany({
    where: dataScope(user),
    select: { id: true, inventoryCode: true, materialDescription: true, buildingId: true, floor: true, room: true },
    orderBy: { inventoryCode: "asc" },
  });

  return (
    <div>
      <PageHeader
        kicker="Required workflow"
        title="Reconcile sample results"
        description="Completed laboratory results that have not been linked to building inventory. Never silently overwrite existing determinations."
      />
      <div className="space-y-4">
        {samples.map((s) => (
          <Panel key={s.id} className="p-5">
            <ReconcileCard
              sample={{
                id: s.id,
                sampleNumber: s.sampleNumber,
                material: s.material,
                floor: s.floor,
                room: s.room,
                location: s.location,
                buildingId: s.buildingId,
                buildingName: `${s.building.buildingNumber} · ${s.building.name}`,
                layers: s.layers.map((l) => ({
                  n: l.layerNumber,
                  desc: l.description,
                  detected: l.result?.asbestosDetected ?? null,
                  pct: l.result?.asbestosPercent ?? null,
                  fibers: parseJson<string[]>(l.result?.fiberTypes || l.fiberTypes, []),
                  method: l.result?.method ?? "",
                })),
              }}
              inventory={inventory.filter((i) => i.buildingId === s.buildingId)}
            />
          </Panel>
        ))}
        {!samples.length && <Panel className="p-8 text-center text-ink-3">All laboratory results have been reconciled.</Panel>}
      </div>
    </div>
  );
}
