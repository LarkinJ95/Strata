"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startInspection, submitInspection, updateRepairStatus } from "@/actions/mutations";

export function StartInspectionButton({ buildingId }: { buildingId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn btn-primary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const id = await startInspection(buildingId);
          router.push(`/inspections/${id}/field`);
        })
      }
    >
      {pending ? "Starting…" : "Start inspection"}
    </button>
  );
}

export function SubmitInspectionForm({ inspectionId }: { inspectionId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await submitInspection(inspectionId, name, notes);
          router.push(`/inspections/${inspectionId}`);
          router.refresh();
        });
      }}
    >
      <div className="field">
        <label>Inspector signature (type full name)</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Sofia Reyes" />
      </div>
      <div className="field">
        <label>Closing notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>
      <button className="btn btn-primary w-full" disabled={pending || !name}>
        {pending ? "Submitting…" : "Sign and submit inspection"}
      </button>
    </form>
  );
}

export function RepairStatusButtons({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {["assigned", "scheduled", "in_progress", "awaiting_verification", "cancelled"].map((s) => (
        <button
          key={s}
          disabled={pending}
          className="btn btn-ghost text-xs capitalize"
          onClick={() =>
            start(async () => {
              await updateRepairStatus(id, s);
              router.refresh();
            })
          }
        >
          {s.replaceAll("_", " ")}
        </button>
      ))}
    </div>
  );
}
