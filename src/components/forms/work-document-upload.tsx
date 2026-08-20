"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DropFileInput } from "@/components/forms/drop-file-input";
import { readStoredSession } from "@/lib/session-client";

export function WorkDocumentUpload({ workRecordId }: { workRecordId: string }) {
  const router = useRouter(); const formRef = useRef<HTMLFormElement>(null); const [pending, start] = useTransition(); const [message, setMessage] = useState(""); const [resetToken, setResetToken] = useState(0);
  return <form ref={formRef} className="space-y-3" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); form.set("workRecordId", workRecordId); setMessage(""); start(async () => { try { const token = readStoredSession(); const response = await fetch(`/api/work/${workRecordId}/documents`, { method: "POST", body: form, headers: token ? { "x-strata-session": token } : undefined }); const result = await response.json().catch(() => null) as { error?: string } | null; if (!response.ok) throw new Error(result?.error || "Could not upload document."); formRef.current?.reset(); setResetToken((value) => value + 1); setMessage("Document stored."); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not upload document."); } }); }}>
    <div className="grid gap-3 md:grid-cols-2"><div className="field md:col-span-2"><label>File</label><DropFileInput name="file" resetToken={resetToken} /></div><div className="field"><label>Document name</label><input name="name" placeholder="Uses filename when blank" /></div><div className="field"><label>Document type</label><select name="docType" defaultValue="work_record"><option value="work_record">Work record</option><option value="proposal">Proposal</option><option value="invoice">Invoice</option><option value="completion_record">Completion record</option><option value="other">Other</option></select></div><div className="field"><label>Document date</label><input name="documentDate" type="date" /></div><div className="field"><label>Description</label><input name="description" /></div></div>
    <div className="flex items-center gap-3"><button className="btn btn-primary" disabled={pending}>{pending ? "Uploading…" : "Upload document"}</button>{message && <span role="status" className="text-sm text-teal-dim">{message}</span>}</div>
  </form>;
}
