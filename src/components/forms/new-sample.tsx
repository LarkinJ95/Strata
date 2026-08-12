"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createSample } from "@/actions/mutations";

export function NewSampleForm({ buildings }: { buildings: { id: string; name: string; buildingNumber: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3 md:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const id = await createSample({
            buildingId: String(fd.get("buildingId")),
            floor: String(fd.get("floor") || ""),
            room: String(fd.get("room") || ""),
            location: String(fd.get("location") || ""),
            material: String(fd.get("material")),
            notes: String(fd.get("notes") || ""),
          });
          router.push(`/samples/${id}`);
        });
      }}
    >
      <div className="field md:col-span-2">
        <label>Building</label>
        <select name="buildingId" required>
          {buildings.map((b) => <option key={b.id} value={b.id}>{b.buildingNumber} · {b.name}</option>)}
        </select>
      </div>
      <div className="field"><label>Floor</label><input name="floor" /></div>
      <div className="field"><label>Room</label><input name="room" /></div>
      <div className="field md:col-span-2"><label>Location</label><input name="location" /></div>
      <div className="field md:col-span-3"><label>Material</label><input name="material" required placeholder="e.g. 12×12 floor tile" /></div>
      <div className="field md:col-span-2"><label>Notes</label><input name="notes" /></div>
      <div className="flex items-end"><button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Collect sample"}</button></div>
    </form>
  );
}
