"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fileUrl } from "@/lib/files";
import { readStoredSession } from "@/lib/session-client";

type Marker = { id: string; recordType: string; recordId: string; x: number; y: number; label: string | null };

export function FloorPlanMapper({ plan, items, samples }: { plan: { id: string; name: string; storageKey: string; markers: Marker[] }; items: { id: string; inventoryCode: string; materialDescription: string }[]; samples: { id: string; sampleNumber: string; material: string; materialDescription: string | null }[] }) {
  const router = useRouter();
  const [recordType, setRecordType] = useState<"inventory" | "sample">("inventory");
  const [itemId, setItemId] = useState("");
  const [message, setMessage] = useState("");
  const [markers, setMarkers] = useState<Marker[]>(plan.markers);
  const [openMarkerId, setOpenMarkerId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return <div className="space-y-3">
    <div className="field"><label>Record type</label><select value={recordType} onChange={(event) => { setRecordType(event.target.value as "inventory" | "sample"); setItemId(""); }}><option value="inventory">Inventory item</option><option value="sample">Sample</option></select></div>
    <div className="field"><label>{recordType === "sample" ? "Sample to pin" : "Inventory item to pin"}</label><select value={itemId} onChange={(event) => setItemId(event.target.value)}><option value="">Choose {recordType === "sample" ? "a sample" : "an item"}</option>{recordType === "inventory" ? items.map((item) => <option key={item.id} value={item.id}>{item.inventoryCode} · {item.materialDescription}</option>) : samples.map((sample) => <option key={sample.id} value={sample.id}>{sample.sampleNumber} · {sample.materialDescription || sample.material}</option>)}</select></div>
    <p className="text-xs text-ink-3">Choose a record, then click its location on the drawing. Teal pins are inventory items; amber pins are samples. Clicking an existing record moves its pin.</p>
    <div className="overflow-auto rounded-xl border border-[rgba(16,36,72,0.08)] bg-paper-2 p-2">
    <div role="button" tabIndex={0} aria-label="Floor plan. Choose a record, then click to place its pin." aria-disabled={!itemId || pending} className="relative block max-w-full cursor-crosshair aria-disabled:cursor-not-allowed aria-disabled:opacity-80" onClick={(event) => {
      if (!itemId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      start(async () => {
        try {
          const token = readStoredSession();
          const response = await fetch(`/api/floor-plans/${plan.id}/markers`, {
            method: "POST",
            headers: { "content-type": "application/json", ...(token ? { "x-strata-session": token } : {}) },
            body: JSON.stringify({ recordType, recordId: itemId, x, y }),
          });
          const payload = await response.json().catch(() => null) as { error?: string; marker?: Marker } | null;
          if (!response.ok) throw new Error(payload?.error || "Could not save pin.");
          if (!payload?.marker) throw new Error("Pin was saved, but could not be displayed.");
          setMarkers((current) => [...current.filter((marker) => !(marker.recordType === payload.marker!.recordType && marker.recordId === payload.marker!.recordId)), payload.marker!]);
          setMessage("Pin saved.");
          router.refresh();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Could not save pin.");
        }
      });
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}<img src={fileUrl(plan.storageKey)} alt={`Place pin on ${plan.name}`} className="block h-auto max-h-[65vh] max-w-full w-auto" />
      {markers.map((marker) => <span key={marker.id} className="group absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}>
        <button type="button" aria-label={`Show ${marker.label || "mapped record"}`} aria-expanded={openMarkerId === marker.id} onClick={(event) => { event.stopPropagation(); setOpenMarkerId((current) => current === marker.id ? null : marker.id); }} className={`h-2.5 w-2.5 rounded-full border border-paper shadow-sm transition-transform hover:scale-150 focus:scale-150 focus:outline-none focus:ring-2 focus:ring-ink-2 ${marker.recordType === "sample" ? "bg-[#c97816]" : "bg-teal"}`} />
        <div className={`pointer-events-none absolute bottom-[calc(100%+0.45rem)] left-1/2 z-10 w-52 -translate-x-1/2 rounded-lg border border-[rgba(16,36,72,0.12)] bg-paper px-3 py-2 text-left text-xs shadow-lg transition ${openMarkerId === marker.id ? "visible opacity-100" : "invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"}`}>
          <p className="font-semibold text-ink">{marker.label || "Mapped record"}</p>
          <p className="mt-0.5 text-ink-3">{marker.recordType === "sample" ? "Sample" : "Inventory item"}</p>
        </div>
      </span>)}
    </div>
    </div>
    {message && <p role="status" className={message === "Pin saved." ? "text-sm text-teal-dim" : "text-sm text-status-action"}>{message}</p>}
  </div>;
}
