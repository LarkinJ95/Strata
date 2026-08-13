"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { DropFileInput } from "@/components/forms/drop-file-input";
import { readStoredSession } from "@/lib/session-client";

export function DocumentUpload({ buildingId }: { buildingId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [resetToken, setResetToken] = useState(0);

  return (
    <form
      ref={formRef}
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        data.set("buildingId", buildingId);
        setMessage("");
        start(async () => {
          try {
            const token = readStoredSession();
            const response = await fetch(`/api/buildings/${buildingId}/documents`, {
              method: "POST",
              body: data,
              headers: token ? { "x-strata-session": token } : undefined,
            });
            const payload = await response.json().catch(() => null) as { error?: string } | null;
            if (!response.ok) throw new Error(payload?.error || "Could not upload document.");
            formRef.current?.reset();
            setResetToken((token) => token + 1);
            setMessage("Document stored.");
            router.refresh();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not upload document.");
          }
        });
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="field md:col-span-2">
          <label>File</label>
          <DropFileInput name="file" resetToken={resetToken} />
        </div>
        <div className="field">
          <label>Document name</label>
          <input name="name" placeholder="Uses the filename when blank" />
        </div>
        <div className="field">
          <label>Document type</label>
          <select name="docType" defaultValue="other">
            {[
              ["survey_report", "Survey report"],
              ["management_plan", "Management plan"],
              ["inspection_report", "Inspection report"],
              ["laboratory_report", "Laboratory report"],
              ["abatement_record", "Abatement record"],
              ["chain_of_custody", "Chain of custody"],
              ["waste_manifest", "Waste manifest"],
              ["drawing", "Drawing / floor plan"],
              ["other", "Other"],
            ].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Document date</label>
          <input name="documentDate" type="date" />
        </div>
        <div className="field">
          <label>Description</label>
          <input name="description" placeholder="Optional" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Uploading…" : "Upload document"}</button>
        {message && <span role="status" className={message === "Document stored." ? "text-sm text-teal-dim" : "text-sm text-status-action"}>{message}</span>}
      </div>
    </form>
  );
}
