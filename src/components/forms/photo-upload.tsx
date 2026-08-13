"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DropFileInput } from "@/components/forms/drop-file-input";
import { readStoredSession } from "@/lib/session-client";

export function PhotoUpload({
  buildingId,
  recordType,
  recordId,
}: {
  buildingId: string;
  recordType: string;
  recordId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("buildingId", buildingId);
        fd.set("recordType", recordType);
        fd.set("recordId", recordId);
        setMsg("");
        start(async () => {
          try {
            const token = readStoredSession();
            const response = await fetch(`/api/buildings/${buildingId}/photos`, {
              method: "POST",
              body: fd,
              headers: token ? { "x-strata-session": token } : undefined,
            });
            const payload = await response.json().catch(() => null) as { error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || "Could not upload photograph.");
            setMsg("Photograph stored.");
            router.refresh();
          } catch (error) {
            setMsg(error instanceof Error ? error.message : "Could not upload photograph.");
          }
        });
      }}
    >
      <div className="min-w-[260px] flex-1">
        <DropFileInput name="file" accept="image/*" capture="environment" label="Drop a photograph here or click to browse" />
      </div>
      <div className="field">
        <label>Category</label>
        <select name="category" defaultValue="material">
          {["material", "location", "close_up", "condition", "damage", "label", "repair_needed", "sample_bag", "before", "after", "other"].map((c) => (
            <option key={c} value={c}>{c.replaceAll("_", " ")}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Caption</label>
        <input name="caption" placeholder="Optional" />
      </div>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Uploading…" : "Add photo"}</button>
      {msg && <span role="status" className={msg === "Photograph stored." ? "text-xs text-teal-dim" : "text-xs text-status-action"}>{msg}</span>}
    </form>
  );
}
