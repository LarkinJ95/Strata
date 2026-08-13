"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { placeFloorPlanMarker } from "@/actions/floor-plan";
import { fileUrl } from "@/lib/files";

export function FloorPlanMapper({ plan, items }: { plan: { id: string; name: string; storageKey: string }; items: { id: string; inventoryCode: string; materialDescription: string }[] }) {
  const router = useRouter();
  const [itemId, setItemId] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  return <div className="space-y-3">
    <div className="field"><label>Inventory item to pin</label><select value={itemId} onChange={(event) => setItemId(event.target.value)}><option value="">Choose an item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.inventoryCode} · {item.materialDescription}</option>)}</select></div>
    <p className="text-xs text-ink-3">Choose an item, then click its location on the drawing. Clicking an existing item moves its pin.</p>
    <button type="button" disabled={!itemId || pending} className="relative block w-full overflow-hidden rounded-xl border border-[rgba(16,36,72,0.08)]" onClick={(event) => {
      if (!itemId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      start(async () => { try { await placeFloorPlanMarker({ floorPlanId: plan.id, inventoryItemId: itemId, x, y }); setMessage("Pin saved."); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save pin."); } });
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}<img src={fileUrl(plan.storageKey)} alt={`Place pin on ${plan.name}`} className="w-full" />
    </button>
    {message && <p className="text-sm text-teal-dim">{message}</p>}
  </div>;
}
