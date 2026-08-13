"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { DropFileInput } from "@/components/forms/drop-file-input";
import { readStoredSession } from "@/lib/session-client";

export function FloorPlanUpload({ buildingId, floors }: { buildingId: string; floors: Array<{ id: string; name: string; level: number }> }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [resetToken, setResetToken] = useState(0);
  return (
    <form
      ref={formRef}
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("buildingId", buildingId);
        setMessage("");
        start(async () => {
          try {
            const token = readStoredSession();
            const response = await fetch(`/api/buildings/${buildingId}/floor-plans`, {
              method: "POST",
              body: fd,
              headers: token ? { "x-strata-session": token } : undefined,
            });
            const payload = await response.json().catch(() => null) as { error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || "Could not upload floor plan.");
            formRef.current?.reset();
            setResetToken((token) => token + 1);
            setMessage("Floor plan stored.");
            router.refresh();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not upload floor plan.");
          }
        });
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="field">
          <label>Drawing name</label>
          <input name="name" required placeholder="Level 2 — clinical wing" />
        </div>
        <div className="field">
          <label>Floor</label>
          <select name="floorId" defaultValue=""><option value="">Applies to the whole building</option>{floors.map((floor) => <option key={floor.id} value={floor.id}>Level {floor.level} — {floor.name}</option>)}</select>
        </div>
        <div className="field md:col-span-2">
          <label>File</label>
          <DropFileInput name="file" accept=".pdf,.png,.jpg,.jpeg,.svg,image/*,application/pdf" resetToken={resetToken} label="Drop a floor plan here or click to browse" />
        </div>
      </div>
      <div className="flex items-center gap-3"><button className="btn btn-primary" disabled={pending}>{pending ? "Uploading…" : "Upload floor plan"}</button>{message && <span role="status" className={message === "Floor plan stored." ? "text-sm text-teal-dim" : "text-sm text-status-action"}>{message}</span>}</div>
    </form>
  );
}
