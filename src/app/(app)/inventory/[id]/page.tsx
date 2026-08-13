import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Beaker, Camera, FileText, History, MapPin, ShieldCheck, Wrench } from "lucide-react";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { AcmChip, ConditionChip, Meta, Panel, SectionTitle } from "@/components/ui/primitives";
import { PhotoThumb } from "@/components/records";
import { formatDate, formatDateTime, formatQty, parseJson } from "@/lib/utils";
import { InventoryActions } from "@/components/forms/inventory-actions";
import { PhotoUpload } from "@/components/forms/photo-upload";
import { InventoryEditor } from "@/components/forms/entity-editors";
import { InventorySampleLink } from "@/components/forms/inventory-sample-link";
import { fileUrl } from "@/lib/files";

export const dynamic = "force-dynamic";

const SECTIONS = ["status", "photos", "samples", "repairs", "documents", "history"] as const;
const SECTION_META = {
  status: { label: "Current status", icon: ShieldCheck },
  photos: { label: "Visual documentation", icon: Camera },
  samples: { label: "Supporting evidence", icon: Beaker },
  repairs: { label: "Repairs & removals", icon: Wrench },
  documents: { label: "Documentation", icon: FileText },
  history: { label: "Full timeline", icon: History },
} as const;

export default async function InventoryDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getSession();
  if (!user) redirect("/login");
  const item = await db.inventoryItem.findFirst({
    where: { id, organizationId: user.organizationId, ...(user.clientId ? { clientId: user.clientId } : {}) },
    include: {
      building: { include: { client: true, facility: true, areas: { orderBy: { name: "asc" }, include: { floor: { select: { name: true } } } } } },
      functionalArea: { select: { id: true, name: true, faCode: true } },
      homogeneousArea: true,
      quantityHistory: { orderBy: { changedAt: "asc" } },
      conditionHistory: { orderBy: { changedAt: "asc" } },
      labelHistory: { orderBy: { changedAt: "desc" } },
      sampleLinks: { include: { sample: { include: { layers: { include: { result: true } }, photoLinks: { include: { photo: true } } } } } },
      repairs: { orderBy: { identifiedAt: "desc" } },
      removals: { orderBy: { removedAt: "desc" } },
      photoLinks: { include: { photo: true }, orderBy: { photo: { uploadedAt: "desc" } } },
      documents: { where: user.isClient ? { visibility: "client" } : undefined, orderBy: { uploadedAt: "desc" } },
      inspectionItems: { include: { inspection: true }, orderBy: { inspectedAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 20, include: { actor: true } },
    },
  });
  if (!item) notFound();

  const samplesForLink = !user.isClient ? await db.sample.findMany({ where: { organizationId: user.organizationId, buildingId: item.buildingId }, select: { id: true, sampleNumber: true, material: true }, orderBy: { sampleNumber: "asc" } }) : [];

  const fibers = parseJson<string[]>(item.fiberTypes, []);
  const primary = item.photoLinks.find((p) => p.primaryPhoto) ?? item.photoLinks[0];
  const section = SECTIONS.includes(sp.section as (typeof SECTIONS)[number]) ? sp.section! : "status";
  const href = (key: string) => `/inventory/${item.id}${key === "status" ? "" : `?section=${key}`}`;

  return (
    <div>
      <div className="crumb mb-3"><Link href="/clients">Clients</Link><span> › </span><Link href={`/clients/${item.clientId}`}>{item.building.client.name}</Link><span> › </span><Link href={`/buildings/${item.buildingId}`}>{item.building.name}</Link><span> › </span><span className="text-ink">{item.inventoryCode}</span></div>
      <Panel className="mb-4 p-5"><div className="flex flex-wrap items-start justify-between gap-5"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><AcmChip value={item.acmClassification} /><ConditionChip value={item.condition} /></div><h1 className="mt-3 font-display text-2xl font-semibold">{item.materialDescription}</h1><div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-ink-2"><MapPin size={15} className="text-teal" />{[item.building.name, item.floor, item.room, item.area, item.specificLocation].filter(Boolean).join(" · ") || "Location not specified"}</div><p className="mt-1 text-sm text-ink-3">{item.inventoryCode}{item.internalCode ? ` · ${item.internalCode}` : ""}{[item.materialCategory, item.homogeneousArea?.haCode].filter(Boolean).map((value) => ` · ${value}`).join("")}</p></div>{primary && <div className="w-32 shrink-0 overflow-hidden rounded-xl border border-[rgba(16,36,72,0.1)]"><PhotoThumb storageKey={primary.photo.storageKey} caption="" /></div>}<div className="flex gap-2"><Link href={`/inventory/${item.id}/print`} className="btn btn-ghost">Print record</Link><Link href={`/buildings/${item.buildingId}`} className="btn btn-ghost">Building</Link></div></div></Panel>

      {item.isProvisional && (
        <div className="mb-4 rounded-xl bg-[#fff4e0] px-4 py-2 text-sm text-[#9a5808]">
          Provisional record — discovered in the field and not yet fully reconciled.
        </div>
      )}

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-[rgba(16,36,72,0.08)]">
        {SECTIONS.map((key) => (
          <Link key={key} href={href(key)} className={`bldg-tab whitespace-nowrap ${section === key ? "active" : ""}`}>
            {(() => { const Icon = SECTION_META[key].icon; return <><Icon size={15} />{SECTION_META[key].label}</>; })()}
          </Link>
        ))}
      </div>

      {section !== "documents" && <div className={`grid gap-6 ${section === "status" || section === "history" ? "xl:grid-cols-[1.1fr_0.9fr]" : "grid-cols-1"}`}>
        <div className="space-y-6">
          {section === "status" && <Panel className="p-5">
            <SectionTitle>Current status</SectionTitle>
            <div className="space-y-3 text-sm">
              {[
                ["ACM classification", <AcmChip key="classification" value={item.acmClassification} />],
                ["Asbestos detected", item.asbestosDetected == null ? "—" : item.asbestosDetected ? "Yes" : "No"],
                ["Fiber type", fibers.join(", ") || "—"],
                ["Asbestos percentage", item.asbestosPercent != null ? `${item.asbestosPercent}%` : "—"],
                ["Friable", item.friable?.replaceAll("_", " ")],
                ["Category I / II", item.categoryIorII],
                ["Analytical method", item.analyticalMethod],
                ["Condition", <ConditionChip key="condition" value={item.condition} />],
                ["Label", item.labelPresent == null ? "—" : item.labelPresent ? item.labelCondition || "Present" : "Missing"],
                ["Recommended response", item.responseAction],
                ["Accessibility", item.accessibility?.replaceAll("_", " ")],
                ["Disturbance potential", item.disturbancePotential],
              ].map(([label, value]) => <div key={String(label)} className="flex items-center justify-between gap-4"><span className="text-ink-3">{label}</span><span className="text-right font-medium capitalize">{value || "—"}</span></div>)}
            </div>
            {item.notes && <p className="mt-4 text-sm text-ink-2">{item.notes}</p>}
          </Panel>}

          {section === "photos" && <Panel className="p-5">
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
          </Panel>}

          {section === "samples" && <Panel className="p-5">
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
          </Panel>}

          {section === "history" && <Panel className="p-5">
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
          </Panel>}
        </div>

        <div className="space-y-6">
          {section === "status" && <Panel className="p-5"><SectionTitle>Quantity summary</SectionTitle><div className="grid grid-cols-2 gap-3"><Meta label="Original" value={<span className="font-display text-lg font-semibold">{formatQty(item.originalQuantity, item.quantityUnit)}</span>} /><Meta label="Current" value={<span className="font-display text-lg font-semibold">{formatQty(item.currentQuantity, item.quantityUnit)}</span>} /><Meta label="Repaired" value={<span className="font-display text-lg font-semibold">{formatQty(item.quantityRepaired, item.quantityUnit)}</span>} /><Meta label="Removed" value={<span className="font-display text-lg font-semibold">{formatQty(item.quantityRemoved, item.quantityUnit)}</span>} /></div><div className="mt-5 border-t border-[rgba(16,36,72,0.1)] pt-4"><div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Recent quantity history</div>{item.quantityHistory.slice(-3).reverse().map((h) => <div key={h.id} className="flex justify-between gap-3 py-1 text-xs"><span>{formatDate(h.changedAt)} · {h.reason}</span><span className="whitespace-nowrap">{formatQty(h.previousQty, h.unit)} → {formatQty(h.newQty, h.unit)}</span></div>)}{!item.quantityHistory.length && <p className="text-sm text-ink-3">No quantity changes recorded.</p>}</div></Panel>}

          {section === "status" && !user.isClient && (
            <Panel className="p-5">
              <SectionTitle>Quick update</SectionTitle>
              <InventoryActions item={item} />
            </Panel>
          )}
          {section === "status" && !user.isClient && (
            <Panel className="p-5">
              <SectionTitle>Edit all inventory details</SectionTitle>
              <InventoryEditor buildingId={item.buildingId} item={item} areas={item.building.areas} />
            </Panel>
          )}

          {section === "history" && <Panel className="p-5">
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
          </Panel>}

          {section === "repairs" && <Panel className="p-5">
            <SectionTitle>Repairs</SectionTitle>
            {item.repairs.map((r) => (
              <Link key={r.id} href={`/repairs/${r.id}`} className="mb-2 block rounded-lg px-2 py-1.5 hover:bg-paper-2">
                <div className="font-medium">{r.repairCode} · {r.status.replaceAll("_", " ")}</div>
                <div className="text-xs text-ink-3">{r.problem}</div>
              </Link>
            ))}
            {!item.repairs.length && <p className="text-sm text-ink-3">No repairs.</p>}
          </Panel>}

          {section === "repairs" && <Panel className="p-5">
            <SectionTitle>Removals</SectionTitle>
            {item.removals.map((r) => (
              <div key={r.id} className="mb-2 text-sm">
                <div className="font-medium">{formatDate(r.removedAt)} · {formatQty(r.quantityRemoved, r.unit)} removed</div>
                <div className="text-xs text-ink-3">Remaining {formatQty(r.quantityRemaining, r.unit)} · {r.projectNumber}</div>
              </div>
            ))}
            {!item.removals.length && <p className="text-sm text-ink-3">No removal events. Historical quantities are never deleted.</p>}
          </Panel>}

          {section === "history" && <Panel className="p-5">
            <SectionTitle>Inspection history</SectionTitle>
            {item.inspectionItems.map((ii) => (
              <div key={ii.id} className="mb-2 text-sm">
                <Link href={`/inspections/${ii.inspectionId}`} className="font-medium capitalize hover:underline">
                  {ii.inspection.inspectionType.replaceAll("_", " ")}
                </Link>
                <div className="text-xs text-ink-3">{formatDateTime(ii.inspectedAt)} · {ii.currentCondition || "not inspected"}</div>
              </div>
            ))}
          </Panel>}

          {section === "history" && <Panel className="p-5">
            <SectionTitle>Full timeline</SectionTitle>
            {item.activities.map((a) => (
              <div key={a.id} className="mb-2">
                <div className="text-[11px] text-ink-3">{formatDateTime(a.createdAt)}</div>
                <div className="text-sm font-medium">{a.title}</div>
              </div>
            ))}
          </Panel>}
        </div>
      </div>}

      {section === "documents" && (
        <Panel className="p-5">
          <SectionTitle>Documentation</SectionTitle>
          <div className="table-wrap"><table className="data"><thead><tr><th>Document</th><th>Type</th><th>Date</th><th>Revision</th></tr></thead><tbody>
            {item.documents.map((doc) => <tr key={doc.id}><td><a href={fileUrl(doc.storageKey)} target="_blank" rel="noreferrer" className="font-medium text-teal-dim hover:underline">{doc.name}</a>{doc.description && <div className="mt-1 text-xs text-ink-3">{doc.description}</div>}</td><td>{doc.docType}</td><td>{formatDate(doc.documentDate ?? doc.uploadedAt)}</td><td>{doc.revision || "—"}</td></tr>)}
            {!item.documents.length && <tr><td colSpan={4} className="text-ink-3">No documents on file.</td></tr>}
          </tbody></table></div>
        </Panel>
      )}
    </div>
  );
}
