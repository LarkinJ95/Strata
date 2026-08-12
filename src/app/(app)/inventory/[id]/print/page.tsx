import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { AcmChip, ConditionChip } from "@/components/ui/primitives";
import { formatDate, formatQty, parseJson } from "@/lib/utils";
import { fileUrl } from "@/lib/files";
import { PrintButton } from "@/components/forms/print-button";

export const dynamic = "force-dynamic";

export default async function InventoryPrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect("/login");
  const item = await db.inventoryItem.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      building: { include: { client: true } },
      quantityHistory: true,
      conditionHistory: true,
      sampleLinks: { include: { sample: { include: { layers: { include: { result: true } } } } } },
      photoLinks: { include: { photo: true } },
    },
  });
  if (!item) notFound();
  const primary = item.photoLinks.find((p) => p.primaryPhoto) ?? item.photoLinks[0];

  return (
    <div className="mx-auto max-w-3xl bg-white p-8">
      <div className="no-print mb-4"><PrintButton /></div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-teal">Digital asbestos record</div>
      <h1 className="font-display text-3xl font-semibold">{item.inventoryCode}</h1>
      <p className="text-lg">{item.materialDescription}</p>
      <p className="text-sm text-ink-3">{item.building.client.name} · {item.building.name} · {item.floor} · {item.room} · {item.specificLocation}</p>
      <div className="mt-3 flex gap-2"><AcmChip value={item.acmClassification} /><ConditionChip value={item.condition} /></div>
      {primary && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileUrl(primary.photo.storageKey)} alt="" className="mt-4 max-h-64 rounded-xl object-cover" />
      )}
      <p className="mt-4 text-sm">Remaining {formatQty(item.currentQuantity, item.quantityUnit)} of original {formatQty(item.originalQuantity, item.quantityUnit)}. Removed {formatQty(item.quantityRemoved, item.quantityUnit)}.</p>
      <h2 className="mt-6 font-display text-lg font-semibold">Supporting samples</h2>
      {item.sampleLinks.map((l) => (
        <p key={l.id} className="text-sm">{l.sample.sampleNumber} layer {l.layerNumber} — {l.sample.layers.map((ly) => ly.result ? (ly.result.asbestosDetected ? `${ly.result.asbestosPercent}% ${parseJson<string[]>(ly.result.fiberTypes, []).join(", ")}` : "ND") : "").join("; ")}</p>
      ))}
      <h2 className="mt-6 font-display text-lg font-semibold">Quantity history</h2>
      {item.quantityHistory.map((h) => (
        <p key={h.id} className="text-sm">{formatDate(h.changedAt)} · {h.reason} · {formatQty(h.newQty, h.unit)}</p>
      ))}
    </div>
  );
}
