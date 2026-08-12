"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createRepair, recordRemoval, updateInventoryField } from "@/actions/mutations";
import { RESPONSE_ACTIONS } from "@/lib/utils";

export function InventoryActions({
  item,
}: {
  item: {
    id: string;
    condition: string;
    labelCondition: string | null;
    responseAction: string | null;
    currentQuantity: number | null;
    quantityUnit: string;
    notes: string | null;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [problem, setProblem] = useState("");
  const [qty, setQty] = useState("");

  return (
    <div className="space-y-4">
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            await updateInventoryField(item.id, {
              condition: fd.get("condition"),
              labelCondition: fd.get("labelCondition"),
              responseAction: fd.get("responseAction"),
              notes: fd.get("notes"),
            });
            router.refresh();
          });
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          <div className="field">
            <label>Condition</label>
            <select name="condition" defaultValue={item.condition}>
              {["good", "fair", "damaged", "significantly_damaged", "needs_repair", "removed", "inaccessible", "unable_to_inspect"].map((c) => (
                <option key={c} value={c}>{c.replaceAll("_", " ")}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Label</label>
            <select name="labelCondition" defaultValue={item.labelCondition ?? ""}>
              <option value="">—</option>
              {["good", "fair", "replaced", "missing", "unable_to_replace"].map((c) => (
                <option key={c} value={c}>{c.replaceAll("_", " ")}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Response action</label>
          <select name="responseAction" defaultValue={item.responseAction ?? ""}>
            <option value="">—</option>
            {RESPONSE_ACTIONS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Notes</label>
          <textarea name="notes" defaultValue={item.notes ?? ""} rows={2} />
        </div>
        <button className="btn btn-primary" disabled={pending}>Save changes</button>
      </form>

      <div className="hairline" />

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const id = await createRepair({ inventoryItemId: item.id, problem, priority: "high", recommendedResponse: "Repair" });
            router.push(`/repairs/${id}`);
          });
        }}
      >
        <div className="field">
          <label>Open repair</label>
          <input value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="Describe the problem" required />
        </div>
        <button className="btn btn-ghost" disabled={pending}>Create repair</button>
      </form>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            await recordRemoval({ inventoryItemId: item.id, quantityRemoved: Number(qty), notes: "Recorded from inventory record" });
            setQty("");
            router.refresh();
          });
        }}
      >
        <div className="field">
          <label>Record removal ({item.quantityUnit})</label>
          <input value={qty} onChange={(e) => setQty(e.target.value)} type="number" min="0" step="0.1" required />
        </div>
        <button className="btn btn-ghost" disabled={pending}>Record removal</button>
      </form>
    </div>
  );
}
