"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { uploadPhoto } from "@/actions/mutations";

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
        start(async () => {
          await uploadPhoto(fd);
          setMsg("Photograph stored.");
          router.refresh();
        });
      }}
    >
      <div className="field">
        <label>Add photo</label>
        <input name="file" type="file" accept="image/*" capture="environment" required />
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
      {msg && <span className="text-xs text-teal-dim">{msg}</span>}
    </form>
  );
}
