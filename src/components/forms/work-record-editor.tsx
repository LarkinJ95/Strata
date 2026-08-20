"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveWorkRecord } from "@/actions/work";
import { AccessField, Disclose } from "@/components/forms/access-field";

type Item = { id: string; inventoryCode: string; materialDescription: string; specificLocation: string | null };
type Work = {
  id: string; workType: string; title: string; description: string | null; status: string; priority: string;
  dueDate: Date | null; vendorName: string | null; contractorId?: string | null; poNumber: string | null; costEstimate: number | null; actualCost: number | null;
  items: { inventoryItemId: string; workNotes: string | null; outcome: string | null }[];
};

const dateValue = (value: Date | null) => value ? new Date(value).toISOString().slice(0, 10) : "";

export function WorkRecordEditor({ buildingId, inventoryItems, assignees = [], contractors = [], work }: { buildingId: string; inventoryItems: Item[]; assignees?: { id: string; name: string }[]; contractors?: { id: string; name: string }[]; work?: Work & { assignedUserId?: string | null } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const original = useMemo(() => new Map(work?.items.map((item) => [item.inventoryItemId, item]) || []), [work]);
  const [selected, setSelected] = useState<string[]>(work?.items.map((item) => item.inventoryItemId) || []);
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(work?.items.map((item) => [item.inventoryItemId, item.workNotes || ""]) || []));
  const [outcomes, setOutcomes] = useState<Record<string, string>>(() => Object.fromEntries(work?.items.map((item) => [item.inventoryItemId, item.outcome || ""]) || []));
  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }
  return (
    <Disclose label={work ? `Edit ${work.id}` : "Add work record"}>
      <form className="space-y-3" action={(form) => start(async () => {
        setMessage("");
        try { const id = await saveWorkRecord(form); setMessage("Work record saved."); router.refresh(); if (!work) router.push(`/work/${id}`); }
        catch (error) { setMessage(error instanceof Error ? error.message : "Could not save work record."); }
      })}>
        <AccessField />
        {work && <input type="hidden" name="id" value={work.id} />}
        <input type="hidden" name="buildingId" value={buildingId} />
        <input type="hidden" name="itemIds" value={JSON.stringify(Object.fromEntries(selected.map((id) => [id, true])))} />
        <input type="hidden" name="itemNotes" value={JSON.stringify(notes)} />
        <input type="hidden" name="itemOutcomes" value={JSON.stringify(outcomes)} />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="field"><label>Type</label><select name="workType" defaultValue={work?.workType || "WO"}>{["WO", "PO", "PMO"].map((value) => <option key={value}>{value}</option>)}</select></div>
          <div className="field"><label>Status</label><select name="status" defaultValue={work?.status || "open"}>{["open", "in_progress", "on_hold", "completed", "cancelled"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></div>
          <div className="field md:col-span-2"><label>Title</label><input name="title" defaultValue={work?.title || ""} required /></div>
          <div className="field md:col-span-2"><label>Description</label><textarea name="description" rows={3} defaultValue={work?.description || ""} /></div>
          <div className="field"><label>Priority</label><select name="priority" defaultValue={work?.priority || "medium"}>{["low", "medium", "high", "critical"].map((value) => <option key={value}>{value}</option>)}</select></div>
          <div className="field"><label>Due date</label><input name="dueDate" type="date" defaultValue={dateValue(work?.dueDate || null)} /></div>
          <div className="field"><label>Vendor / contractor</label><input name="vendorName" defaultValue={work?.vendorName || ""} /></div>
          <div className="field"><label>Registered contractor</label><select name="contractorId" defaultValue={work?.contractorId || ""}><option value="">None selected</option>{contractors.map((contractor) => <option key={contractor.id} value={contractor.id}>{contractor.name}</option>)}</select></div>
          <div className="field"><label>Assignee</label><select name="assignedUserId" defaultValue={work?.assignedUserId || ""}><option value="">Unassigned</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div>
          <div className="field"><label>PO details</label><input name="poNumber" defaultValue={work?.poNumber || ""} /></div>
          <div className="field"><label>Estimated cost</label><input name="costEstimate" type="number" min="0" step="0.01" defaultValue={work?.costEstimate ?? ""} /></div>
          <div className="field"><label>Actual cost</label><input name="actualCost" type="number" min="0" step="0.01" defaultValue={work?.actualCost ?? ""} /></div>
        </div>
        <div><div className="mb-2 text-sm font-semibold">Affected inventory / materials</div><div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-[rgba(16,36,72,0.1)] p-2">
          {inventoryItems.map((item) => { const checked = selected.includes(item.id); const prior = original.get(item.id); return <div key={item.id} className="rounded-lg bg-paper-2 p-2"><label className="flex cursor-pointer gap-2 text-sm"><input type="checkbox" checked={checked} onChange={() => toggle(item.id)} /><span><b>{item.inventoryCode}</b> · {item.materialDescription}{item.specificLocation ? ` · ${item.specificLocation}` : ""}</span></label>{checked && <div className="mt-2 grid gap-2 md:grid-cols-2"><input aria-label={`Work notes for ${item.inventoryCode}`} placeholder="Work notes" value={notes[item.id] ?? prior?.workNotes ?? ""} onChange={(e) => setNotes((all) => ({ ...all, [item.id]: e.target.value }))} /><input aria-label={`Outcome for ${item.inventoryCode}`} placeholder="Outcome" value={outcomes[item.id] ?? prior?.outcome ?? ""} onChange={(e) => setOutcomes((all) => ({ ...all, [item.id]: e.target.value }))} /></div>}</div>; })}
          {!inventoryItems.length && <p className="p-2 text-sm text-ink-3">No inventory items are available for this building.</p>}
        </div></div>
        <div className="flex items-center gap-3"><button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : work ? "Save work record" : "Create work record"}</button>{message && <span role="status" className="text-sm text-teal-dim">{message}</span>}</div>
      </form>
    </Disclose>
  );
}
