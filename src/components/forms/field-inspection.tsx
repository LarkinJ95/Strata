"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { collectInspectionItemSample, saveInspectionItem } from "@/actions/mutations";
import { fileUrl } from "@/lib/files";
import { requiresFieldSample } from "@/lib/inspection-rules";
import { AcmChip, ConditionChip } from "@/components/ui/primitives";
import { PhotoUpload } from "@/components/forms/photo-upload";
import { SubmitInspectionForm } from "@/components/forms/actions-ui";
import { NewMaterialInline } from "@/components/forms/new-material";

const CONDITIONS = [
  { id: "good", label: "Good" },
  { id: "fair", label: "Fair" },
  { id: "needs_repair", label: "Needs repair" },
  { id: "damaged", label: "Damaged" },
  { id: "significantly_damaged", label: "Significantly damaged" },
  { id: "removed", label: "Removed" },
  { id: "inaccessible", label: "Inaccessible" },
];
const LABELS = [
  { id: "good", label: "Good" },
  { id: "replaced", label: "Replaced" },
  { id: "missing", label: "Missing" },
  { id: "unable_to_replace", label: "Could not replace" },
];

type Item = {
  id: string;
  inventoryId: string;
  code: string;
  material: string;
  floor: string | null;
  room: string | null;
  location: string | null;
  qty: number | null;
  unit: string;
  acm: string;
  previousCondition: string | null;
  currentCondition: string | null;
  previousLabel: string | null;
  currentLabel: string | null;
  notes: string | null;
  inspected: boolean;
  sampleCollected: boolean;
  photo: string | null;
  quantityObserved?: number | null;
  materialRemoved?: boolean;
  removedQuantity?: number | null;
};

export function FieldInspection({
  inspectionId,
  building,
  items,
  completion,
}: {
  inspectionId: string;
  building: { id: string; name: string; number: string; photoPolicy: string; photoMessage: string | null; client: string };
  items: Item[];
  completion: number;
}) {
  const [idx, setIdx] = useState(() => Math.max(0, items.findIndex((i) => !i.inspected)));
  const [local, setLocal] = useState(items);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState("");
  const [sampleMessage, setSampleMessage] = useState("");
  const [samplePending, setSamplePending] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [routeQuery, setRouteQuery] = useState("");
  const item = local[idx];
  const done = local.filter((i) => i.inspected && (!requiresFieldSample(i.acm, i.currentCondition) || i.sampleCollected)).length;
  const pct = local.length ? Math.round((done / local.length) * 100) : completion;

  function patch(p: Partial<Item>) {
    if (!item) return;
    const next = { ...item, ...p };
    setLocal((arr) => arr.map((x) => (x.id === item.id ? next : x)));
    start(async () => {
      await saveInspectionItem({
        itemId: item.id,
        currentCondition: next.currentCondition ?? undefined,
        currentLabel: next.currentLabel ?? undefined,
        notes: next.notes ?? undefined,
        quantityObserved: next.quantityObserved,
        materialRemoved: next.materialRemoved,
        removedQuantity: next.removedQuantity,
      });
      setSaved("Autosaved");
      setTimeout(() => setSaved(""), 1200);
    });
  }

  const needsPhoto = useMemo(
    () => ["damaged", "significantly_damaged", "needs_repair", "removed"].includes(item?.currentCondition || "") && building.photoPolicy !== "prohibited",
    [item?.currentCondition, building.photoPolicy]
  );
  const needsSample = requiresFieldSample(item?.acm, item?.currentCondition);

  if (!item) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-2xl font-semibold">No inventory on this inspection</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-teal">{building.client}</div>
          <h1 className="font-display text-xl font-semibold">{building.number} · {building.name}</h1>
        </div>
        <Link href={`/inspections/${inspectionId}`} className="btn btn-ghost text-xs">Exit field mode</Link>
      </div>

      <button className="btn btn-ghost mb-4 w-full" onClick={() => setRouteOpen(true)}>Route · {done}/{local.length} complete</button>
      {routeOpen && <div className="fixed inset-0 z-50 bg-[rgba(12,19,32,0.42)] p-4"><div className="mx-auto mt-8 max-w-xl rounded-2xl bg-white p-4 shadow-xl"><div className="mb-3 flex gap-2"><input autoFocus className="flex-1" placeholder="Search code, material, room" value={routeQuery} onChange={(e) => setRouteQuery(e.target.value)} /><button className="btn btn-ghost" onClick={() => setRouteOpen(false)}>Close</button></div><div className="max-h-[70vh] overflow-y-auto">{local.filter((candidate) => `${candidate.code} ${candidate.material} ${candidate.room || ""}`.toLowerCase().includes(routeQuery.toLowerCase())).map((candidate) => { const actualIndex = local.findIndex((value) => value.id === candidate.id); const sampleOutstanding = requiresFieldSample(candidate.acm, candidate.currentCondition) && !candidate.sampleCollected; return <button key={candidate.id} onClick={() => { setIdx(actualIndex); setRouteOpen(false); }} className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-paper-2 ${actualIndex === idx ? "bg-teal-soft" : ""}`}><span><span className="mr-2">{candidate.inspected && !sampleOutstanding ? "✓" : candidate.currentCondition ? "!" : "○"}</span><b>{candidate.material}</b><span className="ml-2 text-xs text-ink-3">{candidate.code} · {candidate.floor} · {candidate.room}</span></span><span className="text-xs text-ink-3">{sampleOutstanding ? "Sample required" : candidate.currentCondition?.replaceAll("_", " ") || "Untouched"}</span></button>; })}</div></div></div>}

      {building.photoMessage && (
        <div className="mb-4 rounded-xl bg-[#fdecec] px-4 py-3 text-center text-sm font-bold tracking-wide text-[#b42318]">
          {building.photoMessage}
        </div>
      )}

      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs text-ink-3">
          <span>{done} of {local.length} inspected</span>
          <span>{pct}% · {saved || (pending ? "Saving…" : "Idle")}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-paper-3">
          <div className="h-full bg-gradient-to-r from-teal to-teal-glow" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="panel rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mono-id text-teal-dim">{item.code}</div>
            <div className="font-display text-2xl font-semibold leading-tight">{item.material}</div>
            <div className="mt-1 text-sm text-ink-3">{item.floor} · {item.room} · {item.location}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <AcmChip value={item.acm} />
              <span className="chip chip-muted">{item.qty} {item.unit}</span>
              {item.previousCondition && <span className="text-xs text-ink-3">Previously <ConditionChip value={item.previousCondition} /></span>}
              {item.previousCondition && <button className="btn btn-ghost text-xs" onClick={() => patch({ currentCondition: item.previousCondition, inspected: true })}>✓ Same</button>}
            </div>
          </div>
          {item.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl(item.photo)} alt="" className="h-28 w-36 rounded-xl object-cover" />
          )}
        </div>

        <div className="mt-6">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">Condition</div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {CONDITIONS.map((c) => (
              <button
                key={c.id}
                onClick={() => patch({ currentCondition: c.id, inspected: true })}
                className={`btn btn-lg ${item.currentCondition === c.id ? "btn-primary" : "btn-ghost"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {item.currentCondition && item.previousCondition && item.currentCondition !== item.previousCondition && <div className="mt-3 rounded-xl bg-[#fff4e0] px-3 py-2 text-sm text-status-attention">{item.previousCondition.replaceAll("_", " ")} → {item.currentCondition.replaceAll("_", " ")}{["damaged", "significantly_damaged", "needs_repair"].includes(item.currentCondition) && " · repair will be suggested at submit"}</div>}

        {needsSample && (
          <div className={`mt-4 rounded-xl border p-4 ${item.sampleCollected ? "border-[#9bd0bc] bg-[#edf9f3]" : "border-[#efb3a8] bg-[#fff0ed]"}`}>
            <div className={`font-semibold ${item.sampleCollected ? "text-[#176b4d]" : "text-[#a23725]"}`}>
              {item.sampleCollected ? "Required field sample collected" : "Field sample required before this item is complete"}
            </div>
            <p className="mt-1 text-sm text-ink-3">This material is {item.acm === "pacm" ? "PACM" : "assumed ACM"} and its condition requires laboratory confirmation.</p>
            {!item.sampleCollected && (
              <button
                className="btn btn-primary mt-3"
                disabled={samplePending || pending}
                onClick={async () => {
                  setSamplePending(true);
                  setSampleMessage("");
                  try {
                    const result = await collectInspectionItemSample(item.id);
                    setLocal((values) => values.map((value) => value.id === item.id ? { ...value, sampleCollected: true } : value));
                    setSampleMessage(`Sample ${result.sampleNumber} recorded and linked.`);
                  } catch (error) {
                    setSampleMessage(error instanceof Error ? error.message : "Could not record the sample.");
                  } finally {
                    setSamplePending(false);
                  }
                }}
              >
                {samplePending ? "Recording sample…" : "Collect required sample"}
              </button>
            )}
            {sampleMessage && <div role="status" className="mt-2 text-sm font-medium">{sampleMessage}</div>}
          </div>
        )}

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="field"><span>Qty observed</span><input type="number" value={item.quantityObserved ?? ""} onChange={(e) => patch({ quantityObserved: e.target.value ? Number(e.target.value) : null })} /></label>
          <label className="field"><span>Removed quantity</span><input type="number" disabled={!item.materialRemoved} value={item.removedQuantity ?? ""} onChange={(e) => patch({ removedQuantity: e.target.value ? Number(e.target.value) : null })} /></label>
          <label className="field"><span>Removed</span><select value={item.materialRemoved ? "yes" : "no"} onChange={(e) => patch({ materialRemoved: e.target.value === "yes" })}><option value="no">No</option><option value="yes">Yes</option></select></label>
        </div>

        <div className="mt-6">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">Labeling</div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {LABELS.map((c) => (
              <button
                key={c.id}
                onClick={() => patch({ currentLabel: c.id })}
                className={`btn btn-lg ${item.currentLabel === c.id ? "btn-primary" : "btn-ghost"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field mt-6">
          <label>Notes</label>
          <textarea
            rows={3}
            value={item.notes ?? ""}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="Field observations"
          />
        </div>

        {needsPhoto && (
          <div className="mt-4 rounded-xl border border-[#f0d29a] bg-[#fff4e0] p-3">
            <div className="mb-2 text-sm font-semibold text-[#9a5808]">Photograph required for this condition change</div>
            <PhotoUpload buildingId={building.id} recordType="inventory" recordId={item.inventoryId} />
          </div>
        )}
        {!needsPhoto && building.photoPolicy !== "prohibited" && (
          <div className="mt-4">
            <PhotoUpload buildingId={building.id} recordType="inventory" recordId={item.inventoryId} />
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <button className="btn btn-ghost flex-1 btn-lg" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>Previous</button>
          <button className="btn btn-primary flex-1 btn-lg" disabled={idx >= local.length - 1} onClick={() => setIdx((i) => i + 1)}>
            Next material
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="panel rounded-2xl p-4">
          <div className="mb-2 font-display font-semibold">New suspect material</div>
          <NewMaterialInline buildingId={building.id} inspectionId={inspectionId} />
        </div>
        <div className="panel rounded-2xl p-4">
          <div className="mb-2 font-display font-semibold">Sign & submit</div>
          <SubmitInspectionForm inspectionId={inspectionId} />
        </div>
      </div>
    </div>
  );
}
