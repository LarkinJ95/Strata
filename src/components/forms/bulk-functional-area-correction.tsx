"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkAssignFunctionalArea } from "@/actions/records";
import { AccessField } from "@/components/forms/access-field";
import { FunctionalAreaSelect } from "@/components/forms/functional-area-select";

type Item = { id: string; inventoryCode: string; materialDescription: string; buildingId: string; building: { buildingNumber: string; name: string } };
type Area = { id: string; name: string; faCode: string | null; buildingId: string; floor: { name: string } | null };

export function BulkFunctionalAreaCorrection({ items, areas }: { items: Item[]; areas: Area[] }) {
  const router = useRouter(); const [buildingId, setBuildingId] = useState(""); const [pending, start] = useTransition(); const [message, setMessage] = useState("");
  const buildings = useMemo(() => [...new Map(items.map((item) => [item.buildingId, item.building])).entries()], [items]);
  const buildingItems = items.filter((item) => item.buildingId === buildingId);
  const buildingAreas = areas.filter((area) => area.buildingId === buildingId);
  return <form className="space-y-3" action={(form) => start(async () => { try { await bulkAssignFunctionalArea(form); setMessage("Functional area assigned."); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update inventory."); } })}>
    <AccessField />
    <div className="field"><label>Building</label><select value={buildingId} onChange={(event) => setBuildingId(event.target.value)}><option value="">Choose a building</option>{buildings.map(([id, building]) => <option key={id} value={id}>{building.buildingNumber} · {building.name}</option>)}</select></div>
    {buildingId && <><div className="field"><label>Assign selected items to</label><FunctionalAreaSelect areas={buildingAreas} /></div><div className="max-h-64 overflow-auto rounded-xl border border-[rgba(16,36,72,0.1)] p-2">{buildingItems.map((item) => <label key={item.id} className="flex gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-paper-2"><input name="inventoryId" type="checkbox" value={item.id} />{item.inventoryCode} · {item.materialDescription}</label>)}</div><button className="btn btn-primary" disabled={pending}>{pending ? "Assigning…" : "Assign functional area"}</button></>}
    {message && <p className="text-sm text-status-action">{message}</p>}
  </form>;
}
