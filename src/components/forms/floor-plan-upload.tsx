"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { uploadFloorPlan } from "@/actions/floor-plan";

export function FloorPlanUpload({ buildingId }: { buildingId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("buildingId", buildingId);
        start(async () => {
          await uploadFloorPlan(fd);
          router.refresh();
          (e.target as HTMLFormElement).reset();
        });
      }}
    >
      <div className="field">
        <label>Drawing name</label>
        <input name="name" required placeholder="Level 2 — clinical wing" />
      </div>
      <div className="field">
        <label>File (PDF, PNG, JPG, SVG)</label>
        <input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.svg,image/*,application/pdf" required />
      </div>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Uploading…" : "Add to building"}</button>
    </form>
  );
}
