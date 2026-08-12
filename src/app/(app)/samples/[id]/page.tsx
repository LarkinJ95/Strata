import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Chip, Meta, PageHeader, Panel, SectionTitle } from "@/components/ui/primitives";
import { PhotoThumb } from "@/components/records";
import { formatDate, parseJson } from "@/lib/utils";
import { ResultForm } from "@/components/forms/result-form";
import { PhotoUpload } from "@/components/forms/photo-upload";

export const dynamic = "force-dynamic";

export default async function SampleDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect("/login");
  const sample = await db.sample.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      building: true,
      inspector: true,
      laboratory: true,
      layers: { include: { result: true }, orderBy: { layerNumber: "asc" } },
      inventoryLinks: { include: { inventoryItem: true } },
      photoLinks: { include: { photo: true } },
      documents: true,
    },
  });
  if (!sample) notFound();

  return (
    <div>
      <PageHeader
        kicker={sample.building.name}
        title={`Sample ${sample.sampleNumber}`}
        description={`${sample.material} · ${[sample.floor, sample.room, sample.location].filter(Boolean).join(" · ")}`}
        actions={<Link href="/samples/reconcile" className="btn btn-ghost">Reconciliation queue</Link>}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-5">
          <SectionTitle>Collection</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Meta label="Status" value={<Chip tone="ice">{sample.status.replaceAll("_", " ")}</Chip>} />
            <Meta label="Collected" value={formatDate(sample.collectionDate)} />
            <Meta label="Inspector" value={sample.inspector?.name} />
            <Meta label="Laboratory" value={sample.laboratory?.name} />
            <Meta label="Lab number" value={sample.labSampleNumber} />
            <Meta label="Method" value={sample.analysisMethod} />
          </div>
        </Panel>
        <Panel className="p-5">
          <SectionTitle>Layers & results</SectionTitle>
          {sample.layers.map((l) => (
            <div key={l.id} className="mb-3 rounded-xl bg-paper-2 p-3">
              <div className="font-medium">Layer {l.layerNumber} · {l.description}</div>
              {l.result ? (
                <div className="mt-1 text-sm">
                  {l.result.asbestosDetected ? (
                    <span>{l.result.asbestosPercent}% {parseJson<string[]>(l.result.fiberTypes, []).join(", ")} · {l.result.method}</span>
                  ) : (
                    <span>Asbestos not detected · {l.result.method}</span>
                  )}
                </div>
              ) : (
                <div className="text-sm text-ink-3">Awaiting laboratory result</div>
              )}
            </div>
          ))}
          {!user.isClient && <ResultForm sampleId={sample.id} />}
        </Panel>
        <Panel className="p-5">
          <SectionTitle>Linked inventory</SectionTitle>
          {sample.inventoryLinks.map((l) => (
            <Link key={l.id} href={`/inventory/${l.inventoryItemId}`} className="mb-2 block">
              <div className="mono-id text-teal-dim">{l.inventoryItem.inventoryCode}</div>
              <div className="text-xs text-ink-3">{l.inventoryItem.materialDescription} · layer {l.layerNumber} · {l.linkType}</div>
            </Link>
          ))}
          {!sample.inventoryLinks.length && <p className="text-sm text-ink-3">Not yet reconciled with inventory.</p>}
        </Panel>
        <Panel className="p-5">
          <SectionTitle>Photographs</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {sample.photoLinks.map((l) => (
              <PhotoThumb key={l.id} storageKey={l.photo.storageKey} caption={l.category} />
            ))}
          </div>
          {!user.isClient && sample.building.photoPolicy !== "prohibited" && (
            <div className="mt-3"><PhotoUpload buildingId={sample.buildingId} recordType="sample" recordId={sample.id} /></div>
          )}
        </Panel>
      </div>
    </div>
  );
}
