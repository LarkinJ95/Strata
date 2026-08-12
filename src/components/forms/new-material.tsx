"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createSuspectMaterial } from "@/actions/mutations";

export function NewMaterialInline({ buildingId, inspectionId }: { buildingId: string; inspectionId?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const id = await createSuspectMaterial({
            buildingId,
            inspectionId,
            floor: String(fd.get("floor") || ""),
            room: String(fd.get("room") || ""),
            location: String(fd.get("location") || ""),
            material: String(fd.get("material")),
            estimatedQty: fd.get("qty") ? Number(fd.get("qty")) : undefined,
            unit: String(fd.get("unit") || "SF"),
            condition: String(fd.get("condition") || "fair"),
            action: String(fd.get("action") || "Collect sample now"),
            notes: String(fd.get("notes") || ""),
          });
          router.push(`/inventory/${id}`);
        });
      }}
    >
      <input name="material" required placeholder="Material" className="rounded-xl border border-[rgba(16,36,72,0.12)] px-3 py-2" />
      <div className="grid grid-cols-3 gap-2">
        <input name="floor" placeholder="Floor" className="rounded-xl border border-[rgba(16,36,72,0.12)] px-3 py-2" />
        <input name="room" placeholder="Room" className="rounded-xl border border-[rgba(16,36,72,0.12)] px-3 py-2" />
        <input name="qty" placeholder="Qty" className="rounded-xl border border-[rgba(16,36,72,0.12)] px-3 py-2" />
      </div>
      <select name="action" className="rounded-xl border border-[rgba(16,36,72,0.12)] px-3 py-2">
        <option>Collect sample now</option>
        <option>Assume ACM</option>
        <option>Schedule sampling</option>
        <option>Add provisional inventory record</option>
      </select>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Add suspect material"}</button>
    </form>
  );
}
