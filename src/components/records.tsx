import Link from "next/link";
import { AcmChip, ConditionChip, Panel } from "@/components/ui/primitives";
import { fileUrl } from "@/lib/files";
import { formatDate, formatQty, parseJson, riskScore, riskTone } from "@/lib/utils";

export function InventoryTable({
  rows,
  showBuilding = true,
}: {
  rows: {
    id: string;
    inventoryCode: string;
    internalCode?: string | null;
    materialDescription: string;
    materialCategory?: string;
    friable?: string | null;
    floor: string | null;
    room: string | null;
    acmClassification: string;
    condition: string;
    currentQuantity: number | null;
    quantityUnit: string;
    originalQuantity?: number | null;
    quantityRemoved?: number | null;
    asbestosPercent?: number | null;
    fiberTypes?: string;
    responseAction?: string | null;
    accessibility?: string | null;
    disturbancePotential?: string | null;
    isProvisional: boolean;
    building?: { id: string; name: string; buildingNumber: string };
    functionalArea?: { id: string; name: string; faCode: string | null } | null;
    inspectionItems?: { inspectedAt: Date | null; inspection: { inspector: { name: string } | null } }[];
  }[];
  showBuilding?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th aria-label="Risk" className="w-1 p-0" />
            <th>ID</th>
            <th>Material</th>
            {showBuilding && <th>Building</th>}
            <th>Location</th>
            <th>Classification</th>
            <th>Condition</th>
            <th>Qty remaining</th>
            <th>Response</th>
            <th>Last seen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={`w-1 p-0 !px-0 ${riskTone(riskScore(r)) === "danger" ? "bg-status-action" : riskTone(riskScore(r)) === "warn" ? "bg-status-attention" : riskTone(riskScore(r)) === "info" ? "bg-teal" : "bg-ink-3"}`} aria-label={`Risk score ${riskScore(r)}`} />
              <td>
                <Link href={`/inventory/${r.id}`} className="mono-id text-teal-dim">
                  {r.inventoryCode}
                </Link>
                {r.isProvisional && <div className="chip chip-warn mt-1">Provisional</div>}
                {r.internalCode && <div className="mt-0.5 text-[10px] text-ink-3">{r.internalCode}</div>}
              </td>
              <td><div className="font-medium">{r.materialDescription}</div><div className="mt-0.5 text-[10px] text-ink-3">{r.materialCategory}{r.friable ? ` · ${r.friable}` : ""}</div></td>
              {showBuilding && (
                <td>
                  {r.building ? (
                    <Link href={`/buildings/${r.building.id}`} className="hover:underline">
                      {r.building.buildingNumber}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              )}
              <td className="text-ink-2">
                <div>{[r.floor, r.functionalArea?.name ?? r.room].filter(Boolean).join(" · ") || <i className="text-ink-3">no functional area</i>}</div>
                {r.room && <div className="mt-0.5 text-[10px] text-ink-3">{r.room}</div>}
              </td>
              <td>
                <AcmChip value={r.acmClassification} />
                {r.asbestosPercent != null && <div className="mt-1 text-[10px] text-ink-3">{r.asbestosPercent}% {parseJson<string[]>(r.fiberTypes, []).join(", ")}</div>}
              </td>
              <td>
                <ConditionChip value={r.condition} />
              </td>
              <td className="text-right"><div className="mono-id">{formatQty(r.currentQuantity, r.quantityUnit)}</div>{r.originalQuantity && <div className="mt-1 ml-auto h-1 w-[62px] overflow-hidden rounded bg-paper-2"><div className="h-full bg-teal" style={{ width: `${Math.max(0, Math.min(100, ((r.currentQuantity ?? 0) / r.originalQuantity) * 100))}%` }} /></div>}</td>
              <td>{r.responseAction ? <span className="chip chip-muted">{r.responseAction}</span> : "—"}</td>
              <td className="text-xs text-ink-3">{r.inspectionItems?.[0] ? <><div>{formatDate(r.inspectionItems[0].inspectedAt)}</div><div>{r.inspectionItems[0].inspection.inspector?.name ?? "Inspector not recorded"}</div></> : "Not inspected"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PhotoThumb({
  storageKey,
  caption,
  href,
}: {
  storageKey: string;
  caption?: string | null;
  href?: string;
}) {
  const img = (
    <div className="overflow-hidden rounded-xl border border-[rgba(16,36,72,0.08)] bg-paper-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fileUrl(storageKey)} alt={caption || ""} className="h-36 w-full object-cover" />
      {caption && <div className="px-2 py-1.5 text-[11px] text-ink-3">{caption}</div>}
    </div>
  );
  return href ? <Link href={href}>{img}</Link> : img;
}

export function ActivityList({
  items,
}: {
  items: {
    id: string;
    title: string;
    detail: string | null;
    createdAt: Date;
    eventType: string;
    building?: { id: string; name: string } | null;
    actor?: { name: string } | null;
  }[];
}) {
  return (
    <div className="timeline space-y-4 pl-7">
      {items.map((a) => (
        <div key={a.id} className="relative">
          <span className="absolute -left-7 top-1.5 h-2.5 w-2.5 rounded-full bg-teal shadow-glow" />
          <div className="text-[11px] uppercase tracking-wider text-ink-3">{formatDate(a.createdAt)}</div>
          <div className="font-medium">{a.title}</div>
          <div className="text-sm text-ink-3">
            {a.detail}
            {a.building ? ` · ${a.building.name}` : ""}
            {a.actor ? ` · ${a.actor.name}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ComplianceBanner({ status, reasons }: { status: string; reasons: string[] }) {
  const tone = status === "current" ? "ok" : status === "attention" ? "warn" : "danger";
  const label =
    status === "current" ? "Current" : status === "attention" ? "Attention required" : "Action required";
  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            Operational status
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className={`chip chip-${tone}`}>{label}</span>
            <span className="text-xs text-ink-3">Not a legal determination</span>
          </div>
        </div>
        <ul className="text-sm text-ink-2">
          {reasons.map((r) => (
            <li key={r}>· {r}</li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
