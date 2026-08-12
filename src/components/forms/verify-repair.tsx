"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { verifyRepair } from "@/actions/mutations";

export function VerifyRepairForm({ repairId }: { repairId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          await verifyRepair({
            repairId,
            satisfactory: fd.get("ok") === "yes",
            updatedCondition: String(fd.get("condition") || "good"),
            labelStatus: String(fd.get("label") || "good"),
            notes: String(fd.get("notes") || ""),
            followUpRequired: fd.get("ok") !== "yes",
          });
          router.refresh();
        });
      }}
    >
      <div className="field">
        <label>Satisfactory?</label>
        <select name="ok"><option value="yes">Yes — close repair</option><option value="no">No — return to open</option></select>
      </div>
      <div className="field">
        <label>Updated condition</label>
        <select name="condition">
          {["good", "fair", "needs_repair", "damaged"].map((c) => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}
        </select>
      </div>
      <div className="field"><label>Label status</label><input name="label" defaultValue="good" /></div>
      <div className="field"><label>Notes</label><textarea name="notes" rows={2} /></div>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Record verification"}</button>
    </form>
  );
}
