"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { placeFloorPlanMarker } from "@/actions/floor-plan";
import { fileUrl } from "@/lib/files";

export function FloorPlanMapper({ plan, items, samples }: { plan: { id: string; name: string; storageKey: string; markers: { id: string; recordType: string; x: number; y: number; label: string | null }[] }; items: { id: string; inventoryCode: string; materialDescription: string }[]; samples: { id: string; sampleNumber: string; material: string; materialDescription: string | null }[] }) {
  const router = useRouter();
  const [recordType, setRecordType] = useState<"inventory" | "sample">("inventory");
  const [itemId, setItemId] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  return <div className="space-y-3">
    <div className="field"><label>Record type</label><select value={recordType} onChange={(event) => { setRecordType(event.target.value as "inventory" | "sample"); setItemId(""); }}><option value="inventory">Inventory item</option><option value="sample">Sample</option></select></div>
    <div className="field"><label>{recordType === "sample" ? "Sample to pin" : "Inventory item to pin"}</label><select value={itemId} onChange={(event) => setItemId(event.target.value)}><option value="">Choose {recordType === "sample" ? "a sample" : "an item"}</option>{recordType === "inventory" ? items.map((item) => <option key={item.id} value={item.id}>{item.inventoryCode} · {item.materialDescription}</option>) : samples.map((sample) => <option key={sample.id} value={sample.id}>{sample.sampleNumber} · {sample.materialDescription || sample.material}</option>)}</select></div>
    <p className="text-xs text-ink-3">Choose a record, then click its location on the drawing. Teal pins are inventory items; amber pins are samples. Clicking an existing record moves its pin.</p>
    <div className="overflow-auto rounded-xl border border-[rgba(16,36,72,0.08)] bg-paper-2 p-2">
    <button type="button" disabled={!itemId || pending} className="relative block max-w-full cursor-crosshair disabled:cursor-not-allowed disabled:opacity-80" onClick={(event) => {
      if (!itemId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      start(async () => { try { await placeFloorPlanMarker({ floorPlanId: plan.id, recordType, recordId: itemId, x, y }); setMessage("Pin saved."); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save pin."); } });
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}<img src={fileUrl(plan.storageKey)} alt={`Place pin on ${plan.name}`} className="block h-auto max-h-[65vh] max-w-full w-auto" />
      {plan.markers.map((marker) => <span key={marker.id} className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-glow ${marker.recordType === "sample" ? "bg-[#c97816]" : "bg-teal"}`} style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }} title={marker.label || "Mapped record"} />)}
    </button>
    </div>
    {message && <p className="text-sm text-teal-dim">{message}</p>}
  </div>;
}
