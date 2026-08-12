import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Beaker,
  Building2,
  Camera,
  ClipboardCheck,
  FileText,
  MapPin,
  PackageSearch,
  Paintbrush,
  Shield,
  Wrench,
} from "lucide-react";
import { can, getSession, assertBuildingAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { evaluateBuilding } from "@/lib/compliance";
import { AcmChip, Chip, ConditionChip, Panel } from "@/components/ui/primitives";
import { ActivityList, PhotoThumb } from "@/components/records";
import { fileUrl } from "@/lib/files";
import { formatDate, formatNumber, parseJson, photoPolicyMessage } from "@/lib/utils";
import { StartInspectionButton } from "@/components/forms/actions-ui";
import { PhotoUpload } from "@/components/forms/photo-upload";
import { DocumentUpload } from "@/components/forms/document-upload";
import {
  BuildingEditor,
  FloorEditor,
  FunctionalAreaEditor,
  InspectionEditor,
  InventoryEditor,
  PaintSampleEditor,
  PpeEditor,
  RepairEditor,
  SampleEditor,
} from "@/components/forms/entity-editors";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "overview", label: "Overview", icon: Building2 },
  { id: "inventory", label: "Inventory", icon: PackageSearch },
  { id: "samples", label: "Samples", icon: Beaker },
  { id: "paint", label: "Paint", icon: Paintbrush },
  { id: "spaces", label: "Floors / FA", icon: Building2 },
  { id: "ppe", label: "PPE", icon: Shield },
  { id: "repairs", label: "Repairs", icon: Wrench },
  { id: "inspections", label: "Inspections", icon: ClipboardCheck },
  { id: "photos", label: "Photos", icon: Camera },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "activity", label: "Activity", icon: Activity },
] as const;

export default async function BuildingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.id === rawTab) ? rawTab! : "overview";
  const user = await getSession();
  if (!user) redirect("/login");

  const building = await db.building.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      client: true,
      facility: true,
      floors: { orderBy: { level: "asc" }, include: { areas: true } },
      areas: { orderBy: { name: "asc" } },
      paintSamples: { orderBy: { sampleNumber: "asc" } },
      ppeRequirements: { orderBy: { item: "asc" } },
      inventoryItems: { include: { photoLinks: { where: { primaryPhoto: true }, include: { photo: true } } }, orderBy: { inventoryCode: "asc" } },
      repairs: { include: { inventoryItem: true }, orderBy: { identifiedAt: "desc" } },
      samples: { include: { layers: { include: { result: true } } }, orderBy: { collectionDate: "desc" } },
      inspections: { include: { inspector: true }, orderBy: { scheduledDate: "desc" } },
      activities: { include: { actor: true }, orderBy: { createdAt: "desc" }, take: 40 },
      documents: { orderBy: { uploadedAt: "desc" } },
      photos: { orderBy: { uploadedAt: "desc" } },
      floorPlans: true,
    },
  });
  if (!building || !assertBuildingAccess(user, building)) notFound();

  const compliance = await evaluateBuilding(building.id);
  const items = building.inventoryItems;
  const active = items.filter((i) => i.recordStatus === "active");
  const openRepairs = building.repairs.filter((r) => !["closed", "cancelled"].includes(r.status));
  const overdueRepairs = openRepairs.filter((r) => r.scheduledDate && r.scheduledDate < new Date());
  const awaiting = building.repairs.filter((r) => r.status === "awaiting_verification");
  const pendingLab = building.samples.filter((s) => ["collected", "submitted", "at_lab"].includes(s.status));
  const unreconciled = building.samples.filter((s) => ["results_received", "reviewed"].includes(s.status));
  const damaged = active.filter(
    (i) =>
      ["confirmed_acm", "assumed_acm", "pacm"].includes(i.acmClassification) &&
      ["damaged", "significantly_damaged", "needs_repair"].includes(i.condition)
  );
  const counts = {
    confirmed: active.filter((i) => i.acmClassification === "confirmed_acm").length,
    assumed: active.filter((i) => i.acmClassification === "assumed_acm").length,
    pacm: active.filter((i) => i.acmClassification === "pacm").length,
    non: active.filter((i) => i.acmClassification === "non_acm").length,
    unknown: active.filter((i) => i.acmClassification === "unknown").length,
  };
  const qtyTotal = active.reduce((s, i) => s + (i.currentQuantity || 0), 0);
  const units = [...new Set(active.map((i) => i.quantityUnit))].join(" / ") || "units";
  const statusLabel =
    compliance.status === "current" ? "Current" : compliance.status === "attention" ? "Attention Required" : "Action Required";
  const statusTone = compliance.status === "current" ? "ok" : compliance.status === "attention" ? "warn" : "danger";
  const photoMsg = photoPolicyMessage(building.photoPolicy);
  const reasons = compliance.reasons.length ? compliance.reasons : parseJson<string[]>(building.complianceReasons, []);
  const href = (t: string) => `/buildings/${building.id}${t === "overview" ? "" : `?tab=${t}`}`;

  return (
    <div>
      <div className="crumb mb-4">
        <Link href="/clients">Clients</Link>
        <span> › </span>
        <Link href={`/clients/${building.clientId}`}>{building.client.name}</Link>
        <span> › </span>
        <span className="text-ink">{building.name}</span>
      </div>

      <Panel className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Chip tone={statusTone}>{statusLabel}</Chip>
            <h1 className="mt-2 font-display text-2xl font-semibold">{building.name}</h1>
            <div className="mt-1 text-sm text-ink-3">#{building.buildingNumber} · {building.facility.name} · {building.client.name}</div>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-ink-3">
              <MapPin size={14} /> {building.address || building.facility.address || "—"}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {damaged.length > 0 && <span className="chip chip-danger">{damaged.length} damaged material(s)</span>}
              {openRepairs.length > 0 && <span className="chip chip-warn">{openRepairs.length} open repair(s)</span>}
              {photoMsg && <span className="chip chip-danger">{photoMsg}</span>}
            </div>
          </div>
          <div className="text-right text-sm text-ink-2">
            <div>Built {building.yearConstructed ?? "—"}</div>
            <div>{formatNumber(building.squareFootage)} SF</div>
            <div>{building.floorsCount ?? building.floors.length} floors</div>
            <div className="capitalize">{building.occupancyStatus}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={`/api/buildings/${building.id}/packet`} className="btn btn-ghost text-xs" target="_blank" rel="noreferrer">
            Inspection packet PDF
          </a>
          <Link href={`/buildings/${building.id}/plans`} className="btn btn-ghost text-xs">Floor plans</Link>
          {!user.isClient && <StartInspectionButton buildingId={building.id} />}
        </div>
        {!user.isClient && (
          <div className="mt-4">
            <BuildingEditor building={building} />
          </div>
        )}
      </Panel>

      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-[rgba(16,36,72,0.08)]">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.id} href={href(t.id)} className={cn("bldg-tab", tab === t.id && "active")}>
              <Icon size={14} />
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-5">
        {tab === "overview" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel className="p-5">
              <div className="mb-3 font-display font-semibold">ACM Classification</div>
              {[
                ["Confirmed ACM", counts.confirmed],
                ["Assumed ACM", counts.assumed],
                ["PACM", counts.pacm],
                ["Non-ACM", counts.non],
                ["Unknown / Unsampled", counts.unknown],
              ].map(([l, n]) => (
                <div key={String(l)} className="stat-row">
                  <span>{l}</span>
                  <span className="count-pill">{n}</span>
                </div>
              ))}
              <div className="stat-row border-t border-[rgba(16,36,72,0.08)] pt-3 font-semibold">
                <span>Total estimated quantity</span>
                <span>{formatNumber(qtyTotal)} {units}</span>
              </div>
            </Panel>
            <Panel className="p-5">
              <div className="mb-3 font-display font-semibold">Needs Attention</div>
              {[
                ["Damaged materials", damaged.length, "danger"],
                ["Open repairs", openRepairs.length, "warn"],
                ["Overdue repairs", overdueRepairs.length, "danger"],
                ["Awaiting verification", awaiting.length, "warn"],
                ["Pending lab results", pendingLab.length, "ice"],
                ["Unreconciled results", unreconciled.length, "warn"],
                ["Lead-positive paint", building.paintSamples.filter((s) => s.leadDetected).length, "danger"],
              ].map(([l, n]) => (
                <div key={String(l)} className="stat-row">
                  <span className="flex items-center gap-2">
                    {(n as number) > 0 && <AlertTriangle size={13} className="text-[#c97816]" />}
                    {l}
                  </span>
                  <span>{n}</span>
                </div>
              ))}
              <ul className="mt-3 text-xs text-ink-3">
                {reasons.slice(0, 4).map((r) => (
                  <li key={r}>· {r}</li>
                ))}
              </ul>
            </Panel>
            <Panel className="p-5">
              <div className="mb-3 font-display font-semibold">Inspection Status</div>
              {[
                ["Last inspection", formatDate(building.lastInspectionAt)],
                ["Next inspection", formatDate(building.nextInspectionAt)],
                ["Survey status", building.surveyStatus],
                ["Mgmt plan", building.managementPlanStatus],
                ["Photography", building.photoPolicy],
                ["Floors", building.floors.map((f) => f.name).join(", ") || "—"],
              ].map(([l, v]) => (
                <div key={l} className="stat-row">
                  <span className="text-ink-3">{l}</span>
                  <span className="text-right capitalize">{v}</span>
                </div>
              ))}
            </Panel>
            {(building.ppeRequirements.length > 0 || building.paintSamples.length > 0) && (
              <Panel className="p-5 lg:col-span-3">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-2 font-display font-semibold">PPE posted</div>
                    {building.ppeRequirements.length ? building.ppeRequirements.map((p) => (
                      <div key={p.id} className="stat-row"><span>{p.item}</span><span className="text-xs">{p.required ? "Required" : "Recommended"}</span></div>
                    )) : <p className="text-sm text-ink-3">None posted.</p>}
                  </div>
                  <div>
                    <div className="mb-2 font-display font-semibold">Paint sampling</div>
                    <div className="stat-row"><span>Samples</span><span>{building.paintSamples.length}</span></div>
                    <div className="stat-row"><span>Lead positive</span><span>{building.paintSamples.filter((s) => s.leadDetected).length}</span></div>
                    <div className="stat-row"><span>Asbestos in paint</span><span>{building.paintSamples.filter((s) => s.asbestosPaint).length}</span></div>
                  </div>
                </div>
              </Panel>
            )}
          </div>
        )}

        {tab === "inventory" && (
          <div className="space-y-3">
            {!user.isClient && <InventoryEditor buildingId={building.id} />}
            {items.length ? (
              <Panel className="overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-[rgba(16,36,72,0.1)] bg-[rgba(16,36,72,0.025)] text-xs uppercase tracking-[0.08em] text-ink-3">
                      <tr>
                        <th className="px-4 py-3 font-medium">Item #</th>
                        <th className="px-4 py-3 font-medium">Material & location</th>
                        <th className="px-4 py-3 font-medium">Classification</th>
                        <th className="px-4 py-3 font-medium">Condition</th>
                        <th className="px-4 py-3 text-right font-medium">Current quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(16,36,72,0.08)]">
                      {items.map((it) => {
                        const location = [it.floor, it.room, it.area, it.specificLocation].filter(Boolean).join(" · ");
                        return (
                          <tr key={it.id} className="align-top transition-colors hover:bg-[rgba(16,104,108,0.035)]">
                            <td className="p-0"><Link href={`/inventory/${it.id}`} className="block px-4 py-3"><span className="mono-id font-medium text-teal-dim">{it.inventoryCode}</span>{it.internalCode && <span className="mt-1 block text-[11px] text-ink-3">{it.internalCode}</span>}</Link></td>
                            <td className="p-0"><Link href={`/inventory/${it.id}`} className="block px-4 py-3"><span className="font-medium text-ink">{it.materialDescription}</span><span className="mt-1 block text-xs text-ink-3">{location || "Location not specified"}</span></Link></td>
                            <td className="p-0"><Link href={`/inventory/${it.id}`} className="block px-4 py-3"><AcmChip value={it.acmClassification} /></Link></td>
                            <td className="p-0"><Link href={`/inventory/${it.id}`} className="block px-4 py-3"><ConditionChip value={it.condition} /></Link></td>
                            <td className="p-0 text-right"><Link href={`/inventory/${it.id}`} className="block px-4 py-3 whitespace-nowrap text-ink-2">{formatNumber(it.currentQuantity)} {it.quantityUnit}</Link></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
            ) : <p className="text-sm text-ink-3">No inventory materials have been recorded for this building.</p>}
          </div>
        )}

        {tab === "samples" && (
          <div className="space-y-3">
            {!user.isClient && <SampleEditor buildingId={building.id} />}
            {building.samples.map((s) => (
              <Panel key={s.id} className="p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link href={`/samples/${s.id}`} className="mono-id text-teal-dim">{s.sampleNumber}</Link>
                    <div className="font-medium">{s.material}</div>
                    <div className="text-xs text-ink-3">{[s.floor, s.room, s.location].filter(Boolean).join(" · ")}</div>
                  </div>
                  <Chip tone="ice">{s.status.replaceAll("_", " ")}</Chip>
                </div>
                {!user.isClient && <SampleEditor buildingId={building.id} sample={s} />}
              </Panel>
            ))}
          </div>
        )}

        {tab === "paint" && (
          <div className="space-y-3">
            {!user.isClient && (
              <PaintSampleEditor buildingId={building.id} floors={building.floors} areas={building.areas} />
            )}
            {building.paintSamples.map((s) => (
              <Panel key={s.id} className="p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="mono-id text-teal-dim">{s.sampleNumber}</div>
                    <div className="font-medium">{[s.component, s.color, s.substrate].filter(Boolean).join(" · ") || "Paint sample"}</div>
                    <div className="text-xs text-ink-3">{[s.floor, s.room, s.location].filter(Boolean).join(" · ")} · {s.method}</div>
                  </div>
                  <div className="flex gap-1">
                    {s.leadDetected === true && <Chip tone="danger">Lead positive</Chip>}
                    {s.leadDetected === false && <Chip tone="ok">Lead ND</Chip>}
                    {s.asbestosPaint === true && <Chip tone="acm">Asbestos in paint</Chip>}
                  </div>
                </div>
                <div className="text-sm text-ink-2">
                  {s.leadPpm != null && <span>{s.leadPpm} ppm · </span>}
                  {s.leadMgCm2 != null && <span>{s.leadMgCm2} mg/cm² · </span>}
                  {s.resultSummary}
                </div>
                {!user.isClient && <div className="mt-2"><PaintSampleEditor buildingId={building.id} floors={building.floors} areas={building.areas} sample={s} /></div>}
              </Panel>
            ))}
            {!building.paintSamples.length && <p className="text-sm text-ink-3">No paint samples recorded for this building.</p>}
          </div>
        )}

        {tab === "spaces" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="font-display font-semibold">Floors</div>
              {!user.isClient && <FloorEditor buildingId={building.id} />}
              {building.floors.map((f) => (
                <Panel key={f.id} className="p-4">
                  <div className="font-medium">{f.name} <span className="text-xs text-ink-3">level {f.level}</span></div>
                  <div className="text-xs text-ink-3">{f.occupancy || "—"} · {f.squareFootage ? `${f.squareFootage.toLocaleString()} SF` : "SF not set"}</div>
                  <div className="mt-2 text-xs text-ink-2">{f.areas.length} functional area{f.areas.length === 1 ? "" : "s"}</div>
                  {!user.isClient && <div className="mt-2"><FloorEditor buildingId={building.id} floor={f} /></div>}
                </Panel>
              ))}
            </div>
            <div className="space-y-3">
              <div className="font-display font-semibold">Functional areas / rooms</div>
              {!user.isClient && <FunctionalAreaEditor buildingId={building.id} floors={building.floors} />}
              {building.areas.map((a) => (
                <Panel key={a.id} className="p-4">
                  <div className="font-medium">{a.faCode ? `${a.faCode} · ` : ""}{a.name}</div>
                  <div className="text-xs text-ink-3">{a.areaType?.replaceAll("_", " ")} · {building.floors.find((f) => f.id === a.floorId)?.name || "No floor"}</div>
                  {a.useDescription && <div className="mt-1 text-sm text-ink-2">{a.useDescription}</div>}
                  {!user.isClient && <div className="mt-2"><FunctionalAreaEditor buildingId={building.id} floors={building.floors} area={a} /></div>}
                </Panel>
              ))}
            </div>
          </div>
        )}

        {tab === "ppe" && (
          <div className="space-y-3">
            <p className="text-sm text-ink-3">PPE posted here is operational guidance for this building. It does not replace a site-specific hazard assessment.</p>
            {!user.isClient && <PpeEditor buildingId={building.id} />}
            {building.ppeRequirements.map((p) => (
              <Panel key={p.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{p.item}</div>
                    <div className="text-xs text-ink-3">{p.appliesTo || "Entire building"}</div>
                    {p.notes && <div className="mt-1 text-sm text-ink-2">{p.notes}</div>}
                  </div>
                  <Chip tone={p.required ? "danger" : "warn"}>{p.required ? "Required" : "Recommended"}</Chip>
                </div>
                {!user.isClient && <div className="mt-2"><PpeEditor buildingId={building.id} item={p} /></div>}
              </Panel>
            ))}
            {!building.ppeRequirements.length && <p className="text-sm text-ink-3">No PPE requirements posted yet.</p>}
          </div>
        )}

        {tab === "repairs" && (
          <div className="space-y-3">
            {!user.isClient && <RepairEditor inventoryOptions={items} />}
            {building.repairs.map((r) => (
              <Panel key={r.id} className="p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link href={`/repairs/${r.id}`} className="mono-id text-teal-dim">{r.repairCode}</Link>
                    <div className="font-medium">{r.problem}</div>
                    <div className="text-xs text-ink-3">{r.inventoryItem.inventoryCode} · {r.priority}</div>
                  </div>
                  <Chip tone={r.status === "closed" ? "ok" : "warn"}>{r.status.replaceAll("_", " ")}</Chip>
                </div>
                {!user.isClient && <RepairEditor repair={r} inventoryOptions={items} />}
              </Panel>
            ))}
          </div>
        )}

        {tab === "inspections" && (
          <div className="space-y-3">
            {building.inspections.map((i) => (
              <Panel key={i.id} className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <Link href={i.status === "in_progress" ? `/inspections/${i.id}/field` : `/inspections/${i.id}`} className="font-medium capitalize">
                    {i.inspectionType.replaceAll("_", " ")}
                  </Link>
                  <Chip tone={i.status === "completed" ? "ok" : "ice"}>{i.status.replaceAll("_", " ")}</Chip>
                </div>
                <div className="mb-2 text-xs text-ink-3">{formatDate(i.scheduledDate)} · {i.inspector?.name}</div>
                {!user.isClient && <InspectionEditor inspection={i} />}
              </Panel>
            ))}
          </div>
        )}

        {tab === "photos" && (
          <div className="space-y-4">
            {can(user, "photos.add") && building.photoPolicy !== "prohibited" && (
              <Panel className="p-5">
                <div className="mb-3 font-display text-[15px] font-semibold">Upload photographs</div>
                <PhotoUpload buildingId={building.id} recordType="building" recordId={building.id} />
              </Panel>
            )}
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {building.photos.map((p) => (
                <PhotoThumb key={p.id} storageKey={p.storageKey} caption={p.originalFilename} />
              ))}
              {!building.photos.length && <p className="text-ink-3">No photographs on file.</p>}
            </div>
          </div>
        )}

        {tab === "documents" && (
          <div className="space-y-4">
            {can(user, "documents.upload") && (
              <Panel className="p-5">
                <div className="mb-3 font-display text-[15px] font-semibold">Upload document</div>
                <DocumentUpload buildingId={building.id} />
              </Panel>
            )}
            <Panel className="p-5">
              {building.documents.map((d) => (
                <a key={d.id} href={fileUrl(d.storageKey)} className="mb-3 block rounded-xl px-2 py-2 hover:bg-paper-2">
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-ink-3">{d.docType.replaceAll("_", " ")} · rev {d.revision} · {formatDate(d.documentDate)}</div>
                </a>
              ))}
              {building.floorPlans.map((fp) => (
                <div key={fp.id} className="mb-2 text-sm text-ink-2">Floor plan · {fp.name}</div>
              ))}
              {!building.documents.length && !building.floorPlans.length && <p className="text-sm text-ink-3">No documents on file.</p>}
            </Panel>
          </div>
        )}

        {tab === "activity" && (
          <Panel className="p-5">
            <ActivityList items={building.activities} />
          </Panel>
        )}
      </div>
    </div>
  );
}
