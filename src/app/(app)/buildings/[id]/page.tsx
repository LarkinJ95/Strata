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
import { AcmChip, Chip, ConditionChip, Empty, Panel } from "@/components/ui/primitives";
import { ActivityList, InventoryTable, PhotoThumb } from "@/components/records";
import { fileUrl } from "@/lib/files";
import { CONDITION_SEVERITY, conditionTone, formatDate, formatNumber, parseJson, photoPolicyMessage, worstCondition } from "@/lib/utils";
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
  { id: "spaces", label: "Spaces", icon: Building2 },
  { id: "ppe", label: "PPE", icon: Shield },
  { id: "repairs", label: "Repairs", icon: Wrench },
  { id: "inspections", label: "Inspections", icon: ClipboardCheck },
  { id: "photos", label: "Photos", icon: Camera },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "plans", label: "Floor Plans", icon: MapPin },
  { id: "activity", label: "Activity", icon: Activity },
] as const;

const TAB_GROUPS = [
  { id: "overview", label: "Overview", tabs: ["overview"] },
  { id: "materials", label: "Materials", tabs: ["inventory", "samples", "paint"] },
  { id: "spaces", label: "Spaces", tabs: ["spaces"] },
  { id: "program", label: "Program", tabs: ["inspections", "repairs", "ppe"] },
  { id: "records", label: "Records", tabs: ["photos", "documents", "plans"] },
  { id: "activity", label: "Activity", tabs: ["activity"] },
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
    db.inventoryItem.findMany({ where: { buildingId: buildingRecord.id }, include: { functionalArea: { select: { id: true, name: true, faCode: true } }, sampleLinks: { select: { id: true } }, photoLinks: { select: { id: true } } }, orderBy: { inventoryCode: "asc" } }),
    db.repair.findMany({ where: { buildingId: buildingRecord.id }, include: { inventoryItem: true }, orderBy: { identifiedAt: "desc" } }),
    db.sample.findMany({ where: { buildingId: buildingRecord.id }, include: { layers: { include: { result: true } } }, orderBy: { collectionDate: "desc" } }),
    db.inspection.findMany({ where: { buildingId: buildingRecord.id }, include: { inspector: true }, orderBy: { scheduledDate: "desc" } }),
    db.activityEvent.findMany({ where: { buildingId: buildingRecord.id }, include: { actor: true }, orderBy: { createdAt: "desc" }, take: 40 }),
    db.document.findMany({ where: { buildingId: buildingRecord.id }, orderBy: { uploadedAt: "desc" } }),
    db.photo.findMany({ where: { buildingId: buildingRecord.id }, orderBy: { uploadedAt: "desc" } }),
    db.floorPlan.findMany({ where: { buildingId: buildingRecord.id }, include: { markers: true } }),
  ]);
  const building = { ...buildingRecord, floors, areas, paintSamples, ppeRequirements, inventoryItems, repairs, samples, inspections, activities, documents, photos, floorPlans };

  const laboratories = user.isClient ? [] : await db.laboratory.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const clientFacilities = user.isClient ? [] : await db.facility.findMany({
    where: { clientId: building.clientId, organizationId: user.organizationId },
    select: { id: true, name: true, facilityId: true },
    orderBy: { facilityId: "asc" },
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
  const oldestDamagedDays = damaged.length ? Math.max(0, Math.ceil((Date.now() - Math.min(...damaged.map((item) => item.updatedAt.getTime()))) / 86400000)) : 0;
  const counts = {
    confirmed: active.filter((i) => i.acmClassification === "confirmed_acm").length,
    assumed: active.filter((i) => i.acmClassification === "assumed_acm").length,
    pacm: active.filter((i) => i.acmClassification === "pacm").length,
    non: active.filter((i) => i.acmClassification === "non_acm").length,
    unknown: active.filter((i) => i.acmClassification === "unknown").length,
  };
  const matrixClasses = ["confirmed_acm", "assumed_acm", "pacm", "non_acm", "unknown"];
  const matrixConditions = ["good", "fair", "damaged", "significantly_damaged", "inaccessible"];
  const matrixCount = (classification: string, condition?: string) => active.filter((item) => item.acmClassification === classification && (!condition || item.condition === condition)).length;
  const qtyTotal = active.reduce((s, i) => s + (i.currentQuantity || 0), 0);
  const units = [...new Set(active.map((i) => i.quantityUnit))].join(" / ") || "units";
  const statusLabel =
    compliance.status === "current" ? "Current" : compliance.status === "attention" ? "Attention Required" : "Action Required";
  const statusTone = compliance.status === "current" ? "ok" : compliance.status === "attention" ? "warn" : "danger";
  const photoMsg = photoPolicyMessage(building.photoPolicy);
  const reasons = compliance.reasons.length ? compliance.reasons : parseJson<string[]>(building.complianceReasons, []);
  const href = (t: string) => `/buildings/${building.id}${t === "overview" ? "" : `?tab=${t}`}`;
  const activeGroup = TAB_GROUPS.find((group) => (group.tabs as readonly string[]).includes(tab)) ?? TAB_GROUPS[0];
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

      <Panel className="relative overflow-hidden p-4">
        <span className={`absolute inset-y-0 left-0 w-1 ${compliance.status === "current" ? "bg-status-current" : compliance.status === "attention" ? "bg-status-attention" : "bg-status-action"}`} />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <Chip tone={statusTone}>{statusLabel}</Chip>
            <h1 className="mt-2 font-display text-2xl font-semibold">{building.name}</h1>
            <div className="mt-1 text-sm text-ink-3">#{building.buildingNumber} · {building.facility.name} · {building.client.name}</div>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-ink-3">
              <MapPin size={14} /> {building.address || building.facility.address || "—"}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10.5px] uppercase text-ink-3">
              <span>Built {building.yearConstructed ?? "—"}</span>
              <span>{formatNumber(building.squareFootage)} SF</span>
              <span>{building.floorsCount ?? building.floors.length} floors</span>
              <span className="capitalize">{building.occupancyStatus}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {damaged.length > 0 && <Link href={href("inventory")} className="chip chip-danger">{damaged.length} damaged ACM — oldest {oldestDamagedDays} days</Link>}
              {building.nextInspectionAt && building.nextInspectionAt < new Date() && <Link href={href("inspections")} className="chip chip-danger">Inspection overdue — {Math.ceil((Date.now() - building.nextInspectionAt.getTime()) / 86400000)} days</Link>}
              {openRepairs.length > 0 && <Link href={href("repairs")} className="chip chip-warn">{openRepairs.length} open repairs{overdueRepairs.length ? ` — ${overdueRepairs.length} past due` : ""}</Link>}
              {unreconciled.length > 0 && <Link href={href("samples")} className="chip chip-ice">{unreconciled.length} results awaiting reconciliation</Link>}
              {photoMsg && <span className="chip chip-danger">{photoMsg}</span>}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 xl:flex-nowrap">
            {!user.isClient && <StartInspectionButton buildingId={building.id} />}
            <Link href={`/buildings/${building.id}/packet`} className="btn btn-ghost whitespace-nowrap text-xs">Field packet</Link>
            <details className="relative"><summary className="btn btn-ghost cursor-pointer whitespace-nowrap text-xs">Generate ▾</summary><div className="absolute right-0 z-10 mt-1 grid min-w-48 gap-1 rounded-xl border border-[rgba(16,36,72,0.1)] bg-white p-2 shadow-lg"><a href={`/api/buildings/${building.id}/packet?includeFloorPlans=true&packetVersion=20260813-3`} download={`${building.name} Inspection Packet.pdf`} className="rounded-lg px-2 py-1.5 text-xs hover:bg-paper-2">Download inspection packet PDF</a><Link href={`/buildings/${building.id}/management-plan`} className="rounded-lg px-2 py-1.5 text-xs hover:bg-paper-2">Management plan</Link></div></details>
          </div>
        </div>
        {!user.isClient && (
          <details className="mt-4">
            <summary className="btn btn-ghost cursor-pointer text-xs">Edit building</summary>
            <div className="mt-3">
            <BuildingEditor building={building} facilityId={building.facilityId} facilities={clientFacilities} />
            </div>
          </details>
        )}
      </Panel>

      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-[rgba(16,36,72,0.08)]">
        {TAB_GROUPS.map((group) => {
          const defaultTab = group.tabs[0];
          const count = group.id === "materials" ? items.length : group.id === "spaces" ? building.floors.length + building.areas.length : group.id === "program" ? openRepairs.length + building.inspections.length : group.id === "records" ? building.photos.length + building.documents.length : undefined;
          return <Link key={group.id} href={href(defaultTab)} className={cn("bldg-tab", activeGroup.id === group.id && "active")}><span>{group.label}</span>{count !== undefined && <span className="font-mono text-[10.5px] text-ink-3">{count}</span>}{(group.id === "materials" && damaged.length > 0 || group.id === "program" && overdueRepairs.length > 0) && <span className="h-1.5 w-1.5 rounded-full bg-status-action" />}</Link>;
        })}
      </div>
      {activeGroup.tabs.length > 1 && <div className="mt-3 flex flex-wrap gap-2">{activeGroup.tabs.map((item) => { const detail = TABS.find((candidate) => candidate.id === item)!; return <Link key={item} href={href(item)} className={cn("rounded-full border px-3 py-1 text-xs", tab === item ? "border-teal bg-teal-soft text-teal-dim" : "border-[rgba(16,36,72,0.1)] bg-white text-ink-3 hover:bg-paper-2")}>{detail.label}</Link>; })}</div>}

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
              <div className="mb-4"><div className="relative h-2 overflow-hidden rounded-full bg-paper-2"><div className="h-full bg-teal" style={{ width: `${building.lastInspectionAt && building.nextInspectionAt ? `${Math.max(0, Math.min(100, ((Date.now() - building.lastInspectionAt.getTime()) / Math.max(1, building.nextInspectionAt.getTime() - building.lastInspectionAt.getTime())) * 100))}%` : "0%"}` }} /></div><div className="mt-1 flex justify-between font-mono text-[10px] text-ink-3"><span>LAST {formatDate(building.lastInspectionAt)}</span><span className={cn(building.nextInspectionAt && building.nextInspectionAt < new Date() && "text-status-action")}>NEXT {formatDate(building.nextInspectionAt)}</span></div></div>
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
            <Panel className="overflow-hidden p-5 lg:col-span-2">
              <div className="mb-3 font-display font-semibold">Material risk — classification × condition</div>
              <div className="table-wrap"><table className="data"><thead><tr><th>Classification</th>{matrixConditions.map((condition) => <th key={condition}>{condition.replaceAll("_", " ")}</th>)}<th>Total</th></tr></thead><tbody>{matrixClasses.map((classification) => <tr key={classification}><td><AcmChip value={classification} /></td>{matrixConditions.map((condition) => { const count = matrixCount(classification, condition); return <td key={condition}>{count ? <Link href={`/inventory?building=${building.id}&acm=${classification}&condition=${condition}`} className={cn("font-mono text-teal-dim hover:underline", ["damaged", "significantly_damaged"].includes(condition) && "text-status-action")}>{count}</Link> : <span className="text-ink-3">—</span>}</td>; })}<td className="font-mono">{matrixCount(classification)}</td></tr>)}</tbody></table></div>
            </Panel>
            <Panel className="p-5">
              <div className="mb-3 font-display font-semibold">Quantity ledger &amp; record health</div>
              {["sample", "functional area", "photo", "floor plan"].map((label) => { const numerator = label === "sample" ? active.filter((item) => item.sampleLinks?.length).length : label === "functional area" ? active.filter((item) => item.functionalAreaId).length : label === "photo" ? active.filter((item) => item.photoLinks?.length).length : active.filter((item) => item.floorPlanX != null && item.floorPlanY != null).length; const percent = active.length ? Math.round((numerator / active.length) * 100) : 0; return <div key={label} className="mb-3"><div className="flex justify-between text-xs"><span className="capitalize">{label} linked</span><span className="font-mono">{percent}%</span></div><div className="mt-1 h-1.5 overflow-hidden rounded bg-paper-2"><div className={cn("h-full", percent < 50 ? "bg-status-action" : percent < 85 ? "bg-status-attention" : "bg-status-current")} style={{ width: `${percent}%` }} /></div></div>; })}
            </Panel>
          </div>
        )}

        {tab === "inventory" && (
          <div className="space-y-3">
            {!user.isClient && <details><summary className="btn btn-primary cursor-pointer text-xs">Add material</summary><div className="mt-3"><InventoryEditor buildingId={building.id} areas={building.areas} /></div></details>}
            {items.length ? <Panel className="overflow-hidden p-0"><InventoryTable rows={items} showBuilding={false} /></Panel> : <Panel className="p-5"><div className="font-display font-semibold">No materials yet</div><p className="mt-1 text-sm text-ink-3">Add the first material record to start this building’s compliance inventory.</p></Panel>}
          </div>
        )}

        {tab === "samples" && (
          <div className="space-y-3">
            {!user.isClient && <details><summary className="btn btn-primary cursor-pointer text-xs">Add sample</summary><div className="mt-3"><SampleEditor buildingId={building.id} laboratories={laboratories} /></div></details>}
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
                {!user.isClient && <details className="mt-2"><summary className="btn btn-ghost cursor-pointer text-xs">Edit</summary><div className="mt-2"><SampleEditor buildingId={building.id} sample={s} laboratories={laboratories} /></div></details>}
              </Panel>
            ))}
          </div>
        )}

        {tab === "paint" && (
          <div className="space-y-3">
            {!user.isClient && (
              <details><summary className="btn btn-primary cursor-pointer text-xs">Add paint sample</summary><div className="mt-3"><PaintSampleEditor buildingId={building.id} floors={building.floors} areas={building.areas} laboratories={laboratories} /></div></details>
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
                {!user.isClient && <details className="mt-2"><summary className="btn btn-ghost cursor-pointer text-xs">Edit</summary><div className="mt-2"><PaintSampleEditor buildingId={building.id} floors={building.floors} areas={building.areas} sample={s} laboratories={laboratories} /></div></details>}
                {!user.isClient && <details className="mt-2"><summary className="cursor-pointer text-xs text-ink-3">More</summary><form action={deletePaintSample} className="mt-2"><AccessField /><input type="hidden" name="id" value={s.id} /><ConfirmDeleteButton label="Delete paint sample" message="Delete this paint sample permanently?" /></form></details>}
              </Panel>
            ))}
            {!building.paintSamples.length && <p className="text-sm text-ink-3">No paint samples recorded for this building.</p>}
          </div>
        )}

        {tab === "spaces" && (() => {
          // Summarise once so the pills, the header line, and each card read from the same numbers.
          const summary = new Map(building.areas.map((area) => {
            const areaItems = items.filter((item) => item.functionalAreaId === area.id);
            return [area.id, {
              total: areaItems.length,
              acm: areaItems.filter((item) => ["confirmed_acm", "assumed_acm", "pacm"].includes(item.acmClassification)).length,
              worst: worstCondition(areaItems.map((item) => item.condition)),
            }];
          }));
          const visibleSummaries = visibleAreas.map((area) => summary.get(area.id)!);
          const attention = visibleSummaries.filter((s) => s.worst && (CONDITION_SEVERITY[s.worst] ?? 0) >= 4).length;
          const materialCount = visibleSummaries.reduce((sum, s) => sum + s.total, 0);
          const acmCount = visibleSummaries.reduce((sum, s) => sum + s.acm, 0);
          const pill = (active: boolean) => cn("rounded-full px-3 py-1.5 text-xs font-semibold transition", active ? "bg-[#0f2748] text-white" : "bg-[rgba(16,36,72,0.055)] text-ink-2 hover:bg-[rgba(16,36,72,0.09)]");
          return (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  <Link href={spacesHref()} className={pill(activeFloorId === "all")}>All <span className="ml-1 font-mono text-[10px] opacity-60">{building.areas.length}</span></Link>
                  {building.floors.map((floor) => (
                    <Link key={floor.id} href={spacesHref(floor.id)} className={pill(activeFloorId === floor.id)}>
                      {floor.name} <span className="ml-1 font-mono text-[10px] opacity-60">{floor.areas.length}</span>
                    </Link>
                  ))}
                </div>
                {!user.isClient && (
                  <details className="relative">
                    <summary className="btn btn-primary cursor-pointer text-xs">Add space</summary>
                    <div className="mt-3 flex flex-wrap gap-3"><FloorEditor buildingId={building.id} /><FunctionalAreaEditor buildingId={building.id} floors={building.floors} /></div>
                  </details>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                <span><b className="text-ink">{visibleAreas.length}</b> functional area{visibleAreas.length === 1 ? "" : "s"}</span>
                <span>·</span>
                <span><b className="text-ink">{formatNumber(materialCount)}</b> materials</span>
                <span>·</span>
                <span><b className="text-ink">{formatNumber(acmCount)}</b> ACM/PACM</span>
                {activeFloor && (
                  <>
                    <span>·</span>
                    <span>level {activeFloor.level} · {activeFloor.occupancy || "occupancy not set"} · {activeFloor.squareFootage ? `${formatNumber(activeFloor.squareFootage)} SF` : "SF not set"}</span>
                  </>
                )}
                {attention > 0 && <Chip tone="danger" className="ml-1">{attention} area{attention === 1 ? "" : "s"} need attention</Chip>}
              </div>

              {activeFloor && !user.isClient && (
                <details className="mt-2">
                  <summary className="w-fit cursor-pointer list-none text-xs font-semibold text-teal-dim [&::-webkit-details-marker]:hidden">Edit {activeFloor.name}</summary>
                  <div className="mt-2 space-y-2">
                    <FloorEditor buildingId={building.id} floor={activeFloor} />
                    <form action={deleteFloor}><AccessField /><input type="hidden" name="id" value={activeFloor.id} /><ConfirmDeleteButton label="Delete floor" message="Delete this floor? Its functional areas will become unassigned." /></form>
                  </div>
                </details>
              )}

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleAreas.map((a) => {
                  const stat = summary.get(a.id)!;
                  const tone = stat.worst ? conditionTone(stat.worst) : "muted";
                  const rail = { danger: "#b42318", warn: "#d97706", fair: "#d9a441", ok: "#157347", removed: "#8a94a3", muted: "#c2c9d3" }[tone] ?? "#c2c9d3";
                  return (
                    <Panel key={a.id} className="relative overflow-hidden p-4">
                      <span className="absolute inset-y-3 left-0 w-[3px] rounded-r" style={{ background: rail }} />
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {a.faCode && <div className="mono-id text-[10px] font-semibold text-teal-dim">{a.faCode}</div>}
                          <div className="font-medium leading-tight">{a.name}</div>
                          <div className="mt-0.5 text-[11px] text-ink-3">{a.areaType?.replaceAll("_", " ") || "area"} · {building.floors.find((f) => f.id === a.floorId)?.name || "No floor"}</div>
                        </div>
                        {!user.isClient && (
                          <details className="shrink-0">
                            <summary className="cursor-pointer list-none px-1 leading-none text-ink-3 hover:text-ink [&::-webkit-details-marker]:hidden">⋯</summary>
                            <div className="mt-2 space-y-2">
                              <FunctionalAreaEditor buildingId={building.id} floors={building.floors} area={a} />
                              <form action={deleteFunctionalArea}><AccessField /><input type="hidden" name="id" value={a.id} /><ConfirmDeleteButton label="Delete functional area" message="Delete this functional area? Inventory assigned to it will become unassigned." /></form>
                            </div>
                          </details>
                        )}
                      </div>
                      {a.useDescription && <p className="mt-2 line-clamp-2 text-xs text-ink-2">{a.useDescription}</p>}
                      <div className="mt-3 flex items-center gap-3 border-t border-[rgba(16,36,72,0.07)] pt-3">
                        <div><div className="font-mono text-base font-semibold leading-none">{stat.total}</div><div className="mt-0.5 text-[10px] text-ink-3">materials</div></div>
                        <span className="h-6 w-px bg-[rgba(16,36,72,0.1)]" />
                        <div><div className="font-mono text-base font-semibold leading-none">{stat.acm}</div><div className="mt-0.5 text-[10px] text-ink-3">ACM/PACM</div></div>
                        <span className="h-6 w-px bg-[rgba(16,36,72,0.1)]" />
                        {stat.worst ? <ConditionChip value={stat.worst} /> : <Chip tone="muted">None</Chip>}
                      </div>
                      <Link href={stat.total ? `/inventory?building=${building.id}&functionalArea=${a.id}` : `/buildings/${building.id}?tab=inventory`} className="mt-2 inline-block text-xs font-semibold text-teal-dim hover:underline">
                        {stat.total ? "View inventory →" : "Assign inventory →"}
                      </Link>
                    </Panel>
                  );
                })}
              </div>
              {!visibleAreas.length && <Empty title="No functional areas here" body={`Nothing is assigned to ${activeFloor ? activeFloor.name : "this building"} yet. Add a space to start mapping inventory to rooms.`} />}
            </div>
          );
        })()}

        {tab === "ppe" && (
          <div className="space-y-3">
            <p className="text-sm text-ink-3">PPE posted here is operational guidance for this building. It does not replace a site-specific hazard assessment.</p>
            {!user.isClient && <details><summary className="btn btn-primary cursor-pointer text-xs">Add PPE item</summary><div className="mt-3"><PpeEditor buildingId={building.id} /></div></details>}
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
                {!user.isClient && <details className="mt-2"><summary className="btn btn-ghost cursor-pointer text-xs">Edit</summary><div className="mt-2"><PpeEditor buildingId={building.id} item={p} /></div></details>}
              </Panel>
            ))}
            {!building.ppeRequirements.length && <p className="text-sm text-ink-3">No PPE requirements posted yet.</p>}
          </div>
        )}

        {tab === "repairs" && (
          <div className="space-y-3">
            {!user.isClient && <details><summary className="btn btn-primary cursor-pointer text-xs">Add repair</summary><div className="mt-3"><RepairEditor inventoryOptions={items} /></div></details>}
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
                {!user.isClient && <details className="mt-2"><summary className="btn btn-ghost cursor-pointer text-xs">Edit</summary><div className="mt-2"><RepairEditor repair={r} inventoryOptions={items} /></div></details>}
              </Panel>
            ))}
          </div>
        )}

        {tab === "inspections" && (
          <div className="space-y-3">
            {!user.isClient && (
              <div className="flex justify-end">
                <StartInspectionButton buildingId={building.id} label="Add inspection" />
              </div>
            )}
            {building.inspections.map((i) => (
              <Panel key={i.id} className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <Link href={i.status === "in_progress" ? `/inspections/${i.id}/field` : `/inspections/${i.id}`} className="font-medium capitalize">
                    {i.inspectionType.replaceAll("_", " ")}
                  </Link>
                  <Chip tone={i.status === "completed" ? "ok" : "ice"}>{i.status.replaceAll("_", " ")}</Chip>
                </div>
                <div className="mb-2 text-xs text-ink-3">{formatDate(i.scheduledDate)} · {i.inspector?.name}</div>
                {!user.isClient && <details className="mt-2"><summary className="btn btn-ghost cursor-pointer text-xs">Edit</summary><div className="mt-2"><InspectionEditor inspection={i} /></div></details>}
              </Panel>
            ))}
            {!building.inspections.length && <p className="text-sm text-ink-3">No inspections have been recorded for this building.</p>}
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
                    <details><summary className="cursor-pointer text-xs text-ink-3">More</summary><form action={deletePhoto} className="mt-2">
                      <AccessField />
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmDeleteButton label="Delete photo" message="Delete this photograph permanently?" />
                    </form></details>
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
                    <details><summary className="cursor-pointer text-xs text-ink-3">More</summary><form action={deleteFloorPlan} className="mt-2">
                      <AccessField />
                      <input type="hidden" name="id" value={plan.id} />
                      <ConfirmDeleteButton label="Delete floor plan" message="Delete this floor plan and all its map pins? This cannot be undone." />
                    </form></details>
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
                      <details><summary className="cursor-pointer text-xs text-ink-3">More</summary><form action={deleteDocument} className="mt-2">
                        <AccessField />
                        <input type="hidden" name="id" value={d.id} />
                        <ConfirmDeleteButton label="Delete" message="Delete this document permanently?" />
                      </form></details>
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
