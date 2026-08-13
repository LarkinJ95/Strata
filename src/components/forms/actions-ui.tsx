"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelInspection, startInspection, submitInspection, updateRepairStatus } from "@/actions/mutations";
import { Disclose } from "@/components/forms/access-field";

type InspectionBuilding = {
  id: string;
  buildingNumber: string;
  name: string;
  client: { name: string };
  facility: { name: string; facilityId: string };
};

export function AddInspectionControl({ buildings }: { buildings: InspectionBuilding[] }) {
  const router = useRouter();
  const [buildingId, setBuildingId] = useState("");
  const [type, setType] = useState("annual_inspection");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  return (
    <Disclose label="Add inspection">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!buildingId) return;
          setMessage("");
          start(async () => {
            try {
              const id = await startInspection(buildingId, type);
              router.push(`/inspections/${id}/field`);
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Could not create inspection.");
            }
          });
        }}
      >
        <div className="field">
          <label>Building</label>
          <select value={buildingId} onChange={(event) => setBuildingId(event.target.value)} required>
            <option value="">Select a building</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.client.name} · {building.facility.name} · {building.buildingNumber} — {building.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Inspection type</label>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            {[
              ["annual_inspection", "Annual inspection"],
              ["periodic_surveillance", "Periodic surveillance"],
              ["reinspection", "Reinspection"],
              ["limited_survey", "Limited survey"],
              ["pre_renovation", "Pre-renovation"],
              ["pre_demolition", "Pre-demolition"],
            ].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-primary" disabled={pending || !buildingId}>
            {pending ? "Creating…" : "Create and open inspection"}
          </button>
          {message && <span role="status" className="text-sm text-status-action">{message}</span>}
        </div>
      </form>
    </Disclose>
  );
}

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

export function CancelInspectionButton({ inspectionId }: { inspectionId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button className="btn btn-danger text-xs" disabled={pending} onClick={() => {
    if (!window.confirm("Cancel this inspection? It will remain in the audit trail but can no longer be completed.")) return;
    start(async () => { await cancelInspection(inspectionId); router.refresh(); });
  }}>{pending ? "Cancelling…" : "Cancel inspection"}</button>;
}
