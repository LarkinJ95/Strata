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
import { FloorPlanUpload } from "@/components/forms/floor-plan-upload";
import { FloorPlanMapper } from "@/components/forms/floor-plan-mapper";
import { ConfirmDeleteButton } from "@/components/forms/confirm-delete-button";
import { AccessField } from "@/components/forms/access-field";
import { deleteDocument, deletePhoto, deleteFloor, deleteFunctionalArea, deletePaintSample, deleteFloorPlan } from "@/actions/records";
import { useDocumentAsFloorPlan } from "@/actions/floor-plan";
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
  { id: "plans", label: "Floor Plans", icon: MapPin },
  { id: "activity", label: "Activity", icon: Activity },
] as const;

export default async function BuildingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; floor?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab, floor: rawFloor } = await searchParams;
  const tab = TABS.some((t) => t.id === rawTab) ? rawTab! : "overview";
  const user = await getSession();
  if (!user) redirect("/login");

  // D1 limits the number of SQL variables in one query. Loading all nested
  // collections together fails once a building has more than 100 records.
  const buildingRecord = await db.building.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      client: true,
      facility: true,
    },
  });
  if (!buildingRecord || !assertBuildingAccess(user, buildingRecord)) notFound();
  const [floors, areas, paintSamples, ppeRequirements, inventoryItems, repairs, samples, inspections, activities, documents, photos, floorPlans] = await Promise.all([
    db.buildingFloor.findMany({ where: { buildingId: buildingRecord.id }, orderBy: { level: "asc" }, include: { areas: true } }),
    db.buildingArea.findMany({ where: { buildingId: buildingRecord.id }, orderBy: { name: "asc" }, include: { floor: { select: { name: true } } } }),
    db.paintSample.findMany({ where: { buildingId: buildingRecord.id }, orderBy: { sampleNumber: "asc" } }),
    db.buildingPpe.findMany({ where: { buildingId: buildingRecord.id }, orderBy: { item: "asc" } }),
    db.inventoryItem.findMany({ where: { buildingId: buildingRecord.id }, orderBy: { inventoryCode: "asc" } }),
    db.repair.findMany({ where: { buildingId: buildingRecord.id }, include: { inventoryItem: true }, orderBy: { identifiedAt: "desc" } }),
    db.sample.findMany({ where: { buildingId: buildingRecord.id }, include: { layers: { include: { result: true } } }, orderBy: { collectionDate: "desc" } }),
    db.inspection.findMany({ where: { buildingId: buildingRecord.id }, include: { inspector: true }, orderBy: { scheduledDate: "desc" } }),
    db.activityEvent.findMany({ where: { buildingId: buildingRecord.id }, include: { actor: true }, orderBy: { createdAt: "desc" }, take: 40 }),
    db.document.findMany({ where: { buildingId: buildingRecord.id }, orderBy: { uploadedAt: "desc" } }),
    db.photo.findMany({ where: { buildingId: buildingRecord.id }, orderBy: { uploadedAt: "desc" } }),
    db.floorPlan.findMany({ where: { buildingId: buildingRecord.id }, include: { markers: true } }),
  ]);
  const inventoryAreaRows = await db.$queryRawUnsafe<Array<{ id: string; functionalAreaId: string | null }>>('SELECT "id", "functionalAreaId" FROM "InventoryItem" WHERE "buildingId" = ?', buildingRecord.id);
  const inventoryAreaById = new Map(inventoryAreaRows.map((row) => [row.id, row.functionalAreaId]));
  const inventoryWithAreas = inventoryItems.map((item) => ({ ...item, functionalAreaId: inventoryAreaById.get(item.id) ?? null }));
  const building = { ...buildingRecord, floors, areas, paintSamples, ppeRequirements, inventoryItems: inventoryWithAreas, repairs, samples, inspections, activities, documents, photos, floorPlans };

  const laboratories = user.isClient ? [] : await db.laboratory.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

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
  const activeFloorId = tab === "spaces" && building.floors.some((floor) => floor.id === rawFloor) ? rawFloor! : "all";
  const activeFloor = activeFloorId === "all" ? null : building.floors.find((floor) => floor.id === activeFloorId)!;
  const visibleAreas = activeFloor ? building.areas.filter((area) => area.floorId === activeFloor.id) : building.areas;
  const spacesHref = (floorId?: string) => `/buildings/${building.id}?tab=spaces${floorId ? `&floor=${encodeURIComponent(floorId)}` : ""}`;

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
            {!user.isClient && <InventoryEditor buildingId={building.id} areas={building.areas} />}
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
            {!user.isClient && <SampleEditor buildingId={building.id} laboratories={laboratories} />}
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
                {!user.isClient && <SampleEditor buildingId={building.id} sample={s} laboratories={laboratories} />}
              </Panel>
            ))}
          </div>
        )}

        {tab === "paint" && (
          <div className="space-y-3">
            {!user.isClient && (
              <PaintSampleEditor buildingId={building.id} floors={building.floors} areas={building.areas} laboratories={laboratories} />
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
                {!user.isClient && <div className="mt-2"><PaintSampleEditor buildingId={building.id} floors={building.floors} areas={building.areas} sample={s} laboratories={laboratories} /></div>}
                {!user.isClient && <form action={deletePaintSample} className="mt-2"><AccessField /><input type="hidden" name="id" value={s.id} /><ConfirmDeleteButton label="Delete paint sample" message="Delete this paint sample permanently?" /></form>}
              </Panel>
            ))}
            {!building.paintSamples.length && <p className="text-sm text-ink-3">No paint samples recorded for this building.</p>}
          </div>
        )}

        {tab === "spaces" && (
          <div className="space-y-4">
            <div>
              <div className="font-display font-semibold">Floors &amp; functional areas</div>
              <p className="mt-1 text-sm text-ink-3">Choose a floor to focus on its assigned functional areas, or use All to review every area.</p>
            </div>
            <div className="flex gap-1 overflow-x-auto border-b border-[rgba(16,36,72,0.08)]" aria-label="Floor tabs">
              <Link href={spacesHref()} className={cn("bldg-tab", activeFloorId === "all" && "active")}>All <span className="ml-1 text-xs text-ink-3">{building.areas.length}</span></Link>
              {building.floors.map((floor) => (
                <Link key={floor.id} href={spacesHref(floor.id)} className={cn("bldg-tab", activeFloorId === floor.id && "active")}>
                  {floor.name} <span className="ml-1 text-xs text-ink-3">{floor.areas.length}</span>
                </Link>
              ))}
            </div>
            {activeFloor && (
              <Panel className="p-4">
                <div className="font-medium">{activeFloor.name} <span className="text-xs text-ink-3">level {activeFloor.level}</span></div>
                <div className="text-xs text-ink-3">{activeFloor.occupancy || "—"} · {activeFloor.squareFootage ? `${activeFloor.squareFootage.toLocaleString()} SF` : "SF not set"}</div>
                {!user.isClient && <div className="mt-2"><FloorEditor buildingId={building.id} floor={activeFloor} /></div>}
                {!user.isClient && <form action={deleteFloor} className="mt-2"><AccessField /><input type="hidden" name="id" value={activeFloor.id} /><ConfirmDeleteButton label="Delete floor" message="Delete this floor? Its functional areas will become unassigned." /></form>}
              </Panel>
            )}
            {!user.isClient && <div className="flex flex-wrap gap-3"><FloorEditor buildingId={building.id} /><FunctionalAreaEditor buildingId={building.id} floors={building.floors} /></div>}
            <div className="space-y-3">
              <div className="font-display font-semibold">{activeFloor ? `${activeFloor.name} functional areas / rooms` : "All functional areas / rooms"}</div>
              {visibleAreas.map((a) => (
                <Panel key={a.id} className="p-4">
                  <div className="font-medium">{a.faCode ? `${a.faCode} · ` : ""}{a.name}</div>
                  <div className="text-xs text-ink-3">{a.areaType?.replaceAll("_", " ")} · {building.floors.find((f) => f.id === a.floorId)?.name || "No floor"}</div>
                  {a.useDescription && <div className="mt-1 text-sm text-ink-2">{a.useDescription}</div>}
                  <div className="mt-3 border-t border-[rgba(16,36,72,0.08)] pt-3">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">Inventory in this FA</div>
                    {items.filter((item) => item.functionalAreaId === a.id).map((item) => (
                      <Link key={item.id} href={`/inventory/${item.id}`} className="block rounded-lg px-2 py-1 text-sm hover:bg-paper-2">
                        <span className="mono-id text-teal-dim">{item.inventoryCode}</span> · {item.materialDescription}
                      </Link>
                    ))}
                    {!items.some((item) => item.functionalAreaId === a.id) && <div className="text-xs text-ink-3">No inventory assigned to this functional area.</div>}
                  </div>
                  {!user.isClient && <div className="mt-2"><FunctionalAreaEditor buildingId={building.id} floors={building.floors} area={a} /></div>}
                  {!user.isClient && <form action={deleteFunctionalArea} className="mt-2"><AccessField /><input type="hidden" name="id" value={a.id} /><ConfirmDeleteButton label="Delete functional area" message="Delete this functional area? Inventory assigned to it will become unassigned." /></form>}
                </Panel>
              ))}
              {!visibleAreas.length && <p className="text-sm text-ink-3">No functional areas are assigned to {activeFloor ? activeFloor.name : "this building"}.</p>}
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
                <div key={p.id} className="space-y-2">
                  <PhotoThumb storageKey={p.storageKey} caption={p.originalFilename} />
                  {!user.isClient && (
                    <form action={deletePhoto}>
                      <AccessField />
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmDeleteButton label="Delete photo" message="Delete this photograph permanently?" />
                    </form>
                  )}
                </div>
              ))}
              {!building.photos.length && <p className="text-ink-3">No photographs on file.</p>}
            </div>
          </div>
        )}

        {tab === "plans" && (
          <div className="space-y-4">
            {can(user, "documents.upload") && (
              <Panel className="p-5">
                <div className="mb-3 font-display text-[15px] font-semibold">Upload floor plan</div>
                <FloorPlanUpload buildingId={building.id} floors={building.floors} />
              </Panel>
            )}
            {building.floorPlans.map((plan) => (
              <Panel key={plan.id} className="p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-display text-[15px] font-semibold">{plan.name}</div>
                    <p className="mt-1 text-xs text-ink-3">Pin inventory items or samples directly on the drawing. Existing pins appear below.</p>
                  </div>
                  {!user.isClient && (
                    <form action={deleteFloorPlan}>
                      <AccessField />
                      <input type="hidden" name="id" value={plan.id} />
                      <ConfirmDeleteButton label="Delete floor plan" message="Delete this floor plan and all its map pins? This cannot be undone." />
                    </form>
                  )}
                </div>
                {!user.isClient && <div className="max-w-5xl"><FloorPlanMapper plan={plan} items={building.inventoryItems} samples={building.samples} /></div>}
              </Panel>
            ))}
            {!building.floorPlans.length && <Panel className="p-5 text-sm text-ink-3">No floor plans have been uploaded.</Panel>}
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
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-display text-[15px] font-semibold">Documents</div>
                  <p className="mt-1 text-xs text-ink-3">Use a drawing or floor plan below for interactive inventory mapping.</p>
                </div>
                <Link href={href("plans")} className="btn btn-ghost text-xs">Open Floor Plans</Link>
              </div>
              {building.documents.map((d) => (
                <div key={d.id} className="mb-3 flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-paper-2">
                  <a href={fileUrl(d.storageKey)} className="min-w-0 flex-1">
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-ink-3">{d.docType.replaceAll("_", " ")} · rev {d.revision} · {formatDate(d.documentDate)}</div>
                  </a>
                  <div className="flex shrink-0 items-center gap-2">
                    {d.docType === "drawing" && can(user, "documents.upload") && (
                      <form action={useDocumentAsFloorPlan}>
                        <input type="hidden" name="documentId" value={d.id} />
                        <button className="btn btn-ghost text-xs">Map on floor plan</button>
                      </form>
                    )}
                    {!user.isClient && (
                      <form action={deleteDocument}>
                        <AccessField />
                        <input type="hidden" name="id" value={d.id} />
                        <ConfirmDeleteButton label="Delete" message="Delete this document permanently?" />
                      </form>
                    )}
                  </div>
                </div>
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
