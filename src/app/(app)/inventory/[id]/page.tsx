import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { AcmChip, ConditionChip, Meta, PageHeader, Panel, SectionTitle } from "@/components/ui/primitives";
import { PhotoThumb } from "@/components/records";
import { formatDate, formatDateTime, formatQty, parseJson } from "@/lib/utils";
import { InventoryActions } from "@/components/forms/inventory-actions";
import { PhotoUpload } from "@/components/forms/photo-upload";
import { PhotoCompare } from "@/components/forms/photo-compare";
import { InventoryEditor } from "@/components/forms/entity-editors";
import { InventorySampleLink } from "@/components/forms/inventory-sample-link";

export const dynamic = "force-dynamic";

export default async function InventoryDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect("/login");
  const item = await db.inventoryItem.findFirst({
    where: { id, organizationId: user.organizationId, ...(user.clientId ? { clientId: user.clientId } : {}) },
    include: {
      building: { include: { client: true, facility: true } },
      homogeneousArea: true,
      quantityHistory: { orderBy: { changedAt: "asc" } },
      conditionHistory: { orderBy: { changedAt: "asc" } },
      labelHistory: { orderBy: { changedAt: "desc" } },
      sampleLinks: { include: { sample: { include: { layers: { include: { result: true } }, photoLinks: { include: { photo: true } } } } } },
      repairs: { orderBy: { identifiedAt: "desc" } },
      removals: { orderBy: { removedAt: "desc" } },
      photoLinks: { include: { photo: true }, orderBy: { photo: { uploadedAt: "desc" } } },
      documents: true,
      inspectionItems: { include: { inspection: true }, orderBy: { inspectedAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 20, include: { actor: true } },
    },
  });
  if (!item) notFound();

  const samplesForLink = !user.isClient ? await db.sample.findMany({ where: { organizationId: user.organizationId, buildingId: item.buildingId }, select: { id: true, sampleNumber: true, material: true }, orderBy: { sampleNumber: "asc" } }) : [];

  const fibers = parseJson<string[]>(item.fiberTypes, []);
  const primary = item.photoLinks.find((p) => p.primaryPhoto) ?? item.photoLinks[0];

  return (
    <div>
      <PageHeader
        kicker={`${item.building.client.name} · ${item.building.name}`}
        title={item.materialDescription}
        description={`${item.inventoryCode} · ${item.floor} · ${item.room} · ${item.specificLocation}`}
        actions={
          <>
            <Link href={`/inventory/${item.id}/print`} className="btn btn-ghost">Print record</Link>
            <Link href={`/buildings/${item.buildingId}`} className="btn btn-ghost">Building</Link>
          </>
        }
      />

      {item.isProvisional && (
        <div className="mb-4 rounded-xl bg-[#fff4e0] px-4 py-2 text-sm text-[#9a5808]">
          Provisional record — discovered in the field and not yet fully reconciled.
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Panel className="p-5">
            <SectionTitle>Current status</SectionTitle>
            <div className="flex flex-wrap gap-2">
              <AcmChip value={item.acmClassification} />
              <ConditionChip value={item.condition} />
              {item.friable && <span className="chip chip-muted">{item.friable.replaceAll("_", " ")}</span>}
              {item.labelPresent === false && <span className="chip chip-warn">Label missing</span>}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
              <Meta label="Quantity remaining" value={formatQty(item.currentQuantity, item.quantityUnit)} />
              <Meta label="Original quantity" value={formatQty(item.originalQuantity, item.quantityUnit)} />
              <Meta label="Removed" value={formatQty(item.quantityRemoved, item.quantityUnit)} />
              <Meta label="Fiber types" value={fibers.join(", ") || "—"} />
              <Meta label="Percent asbestos" value={item.asbestosPercent != null ? `${item.asbestosPercent}%` : "—"} />
              <Meta label="Method" value={item.analyticalMethod} />
              <Meta label="Accessibility" value={item.accessibility?.replaceAll("_", " ")} />
              <Meta label="Disturbance" value={item.disturbancePotential} />
              <Meta label="Response" value={item.responseAction} />
              <Meta label="Label" value={item.labelCondition} />
              <Meta label="Homogeneous area" value={item.homogeneousArea?.haCode} />
              <Meta label="Category I / II" value={item.categoryIorII} />
            </div>
            {item.notes && <p className="mt-4 text-sm text-ink-2">{item.notes}</p>}
          </Panel>

          <Panel className="p-5">
            <SectionTitle>Visual documentation</SectionTitle>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {item.photoLinks.map((l) => (
                <div key={l.id}>
                  <PhotoThumb storageKey={l.photo.storageKey} caption={`${l.category}${l.caption ? " · " + l.caption : ""}`} />
                </div>
              ))}
              {!item.photoLinks.length && <p className="text-sm text-ink-3">No photographs on file.</p>}
            </div>
            {!user.isClient && item.building.photoPolicy !== "prohibited" && (
              <div className="mt-4">
                <PhotoUpload buildingId={item.buildingId} recordType="inventory" recordId={item.id} />
              </div>
            )}
          </Panel>

          <Panel className="p-5">
            <SectionTitle>Supporting samples</SectionTitle>
            {item.sampleLinks.map((link) => (
              <div key={link.id} className="mb-4 rounded-xl border border-[rgba(16,36,72,0.06)] p-3">
                <Link href={`/samples/${link.sample.id}`} className="mono-id text-teal-dim">{link.sample.sampleNumber}</Link>
                <div className="text-xs text-ink-3">Layer {link.layerNumber ?? "—"} · {link.linkType} · {link.sample.location}</div>
                <div className="mt-2 space-y-1 text-sm">
                  {link.sample.layers.map((ly) => (
                    <div key={ly.id}>
                      Layer {ly.layerNumber}: {ly.description} — {ly.result ? (ly.result.asbestosDetected ? `${ly.result.asbestosPercent}% ${parseJson<string[]>(ly.result.fiberTypes, []).join(", ")} (${ly.result.method})` : "None detected") : "No result"}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!item.sampleLinks.length && <p className="text-sm text-ink-3">No linked samples yet.</p>}
            {!user.isClient && <InventorySampleLink inventoryItemId={item.id} samples={samplesForLink} />}
          </Panel>

          <Panel className="p-5">
            <SectionTitle>Quantity history</SectionTitle>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Date</th><th>Previous</th><th>New</th><th>Delta</th><th>Reason</th></tr></thead>
                <tbody>
                  {item.quantityHistory.map((h) => (
                    <tr key={h.id}>
                      <td>{formatDate(h.changedAt)}</td>
                      <td>{formatQty(h.previousQty, h.unit)}</td>
                      <td>{formatQty(h.newQty, h.unit)}</td>
                      <td>{h.delta != null ? `${h.delta > 0 ? "+" : ""}${h.delta}` : "—"}</td>
                      <td>{h.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          {primary && (
            <Panel className="overflow-hidden">
              <PhotoThumb storageKey={primary.photo.storageKey} caption="Primary inventory photograph" />
            </Panel>
          )}

          {!user.isClient && (
            <Panel className="p-5">
              <SectionTitle>Quick update</SectionTitle>
              <InventoryActions item={item} />
            </Panel>
          )}
          {!user.isClient && (
            <Panel className="p-5">
              <SectionTitle>Edit all inventory details</SectionTitle>
              <InventoryEditor buildingId={item.buildingId} item={item} />
            </Panel>
          )}

          <Panel className="p-5">
            <SectionTitle>Condition history</SectionTitle>
            <div className="timeline space-y-3 pl-7">
              {item.conditionHistory.map((h) => (
                <div key={h.id} className="relative">
                  <span className="absolute -left-7 top-1.5 h-2.5 w-2.5 rounded-full bg-teal" />
                  <div className="text-[11px] text-ink-3">{formatDate(h.changedAt)}</div>
                  <div className="text-sm">{h.previousCondition || "—"} → {h.newCondition}</div>
                  {h.notes && <div className="text-xs text-ink-3">{h.notes}</div>}
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <SectionTitle>Repairs</SectionTitle>
            {item.repairs.map((r) => (
              <Link key={r.id} href={`/repairs/${r.id}`} className="mb-2 block rounded-lg px-2 py-1.5 hover:bg-paper-2">
                <div className="font-medium">{r.repairCode} · {r.status.replaceAll("_", " ")}</div>
                <div className="text-xs text-ink-3">{r.problem}</div>
              </Link>
            ))}
            {!item.repairs.length && <p className="text-sm text-ink-3">No repairs.</p>}
          </Panel>

          <Panel className="p-5">
            <SectionTitle>Removals</SectionTitle>
            {item.removals.map((r) => (
              <div key={r.id} className="mb-2 text-sm">
                <div className="font-medium">{formatDate(r.removedAt)} · {formatQty(r.quantityRemoved, r.unit)} removed</div>
                <div className="text-xs text-ink-3">Remaining {formatQty(r.quantityRemaining, r.unit)} · {r.projectNumber}</div>
              </div>
            ))}
            {!item.removals.length && <p className="text-sm text-ink-3">No removal events. Historical quantities are never deleted.</p>}
          </Panel>

          <Panel className="p-5">
            <SectionTitle>Inspection history</SectionTitle>
            {item.inspectionItems.map((ii) => (
              <div key={ii.id} className="mb-2 text-sm">
                <Link href={`/inspections/${ii.inspectionId}`} className="font-medium capitalize hover:underline">
                  {ii.inspection.inspectionType.replaceAll("_", " ")}
                </Link>
                <div className="text-xs text-ink-3">{formatDateTime(ii.inspectedAt)} · {ii.currentCondition || "not inspected"}</div>
              </div>
            ))}
          </Panel>

          <Panel className="p-5">
            <SectionTitle>Full timeline</SectionTitle>
            {item.activities.map((a) => (
              <div key={a.id} className="mb-2">
                <div className="text-[11px] text-ink-3">{formatDateTime(a.createdAt)}</div>
                <div className="text-sm font-medium">{a.title}</div>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  );
}
