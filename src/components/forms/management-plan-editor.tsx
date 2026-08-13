"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AccessField } from "@/components/forms/access-field";
import { saveManagementPlan } from "@/actions/records";

type Plan = {
  id?: string; revision?: number; status?: string; effectiveDate?: Date | null; reviewDueDate?: Date | null; preparedBy?: string | null; approvedBy?: string | null; approvedAt?: Date | null; responsiblePerson?: string | null; responseProcedures?: string | null; emergencyProcedures?: string | null; trainingNotes?: string | null; notificationNotes?: string | null; additionalNotes?: string | null;
};

const date = (value?: Date | null) => value ? new Date(value).toISOString().slice(0, 10) : "";
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="field"><label>{label}</label>{children}</div>;

const BEST_PRACTICE_DEFAULTS = {
  responseProcedures: "Maintain a current inventory of suspect and confirmed asbestos-containing materials. Before maintenance, renovation, or other disturbance, review the affected material record and use trained personnel. Assess damaged material promptly, restrict access as needed, and document corrective actions, repairs, encapsulation, or removal.",
  emergencyProcedures: "Stop work immediately if asbestos-containing material may have been disturbed. Isolate the area, prevent further access, and notify the designated responsible person. Do not dry sweep or use compressed air. Arrange a qualified assessment, document the event, and complete any required cleanup, notification, and clearance before reoccupying the area.",
  trainingNotes: "Provide role-appropriate asbestos awareness to maintenance, custodial, and project personnel before they work in affected areas. Make material locations, work restrictions, and the responsible-person contact available to employees and contractors. Record completed training and refresh it when duties or conditions change.",
  notificationNotes: "Keep this plan, current inventory, inspection results, laboratory reports, response-action records, and related documents accessible to authorized personnel. Communicate relevant material information and work restrictions before affected work begins. Retain records according to the organization's retention requirements and applicable regulations.",
  additionalNotes: "This editable starting point is based on common asbestos-management practices. Review and tailor it to the building, organization policies, applicable regulations, and professional recommendations before approval.",
};

export function ManagementPlanEditor({ buildingId, plan }: { buildingId: string; plan?: Plan }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return <form action={(form) => start(async () => { setMessage(""); try { await saveManagementPlan(form); setMessage("Management plan saved."); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save management plan."); } })} className="space-y-5">
    <AccessField />
    {plan?.id && <input type="hidden" name="id" value={plan.id} />}
    <input type="hidden" name="buildingId" value={buildingId} />
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Field label="Plan status"><select name="status" defaultValue={plan?.status ?? "draft"}><option value="draft">Draft</option><option value="review">In review</option><option value="approved">Approved</option><option value="superseded">Superseded</option></select></Field>
      <Field label="Effective date"><input name="effectiveDate" type="date" defaultValue={date(plan?.effectiveDate)} /></Field>
      <Field label="Review due"><input name="reviewDueDate" type="date" defaultValue={date(plan?.reviewDueDate)} /></Field>
      <Field label="Prepared by"><input name="preparedBy" defaultValue={plan?.preparedBy ?? ""} /></Field>
      <Field label="Approved by"><input name="approvedBy" defaultValue={plan?.approvedBy ?? ""} /></Field>
      <Field label="Approval date"><input name="approvedAt" type="date" defaultValue={date(plan?.approvedAt)} /></Field>
      <Field label="Responsible person"><input name="responsiblePerson" defaultValue={plan?.responsiblePerson ?? ""} placeholder="Name and title" /></Field>
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      <Field label="Response-action procedures"><textarea name="responseProcedures" rows={6} defaultValue={plan?.responseProcedures ?? BEST_PRACTICE_DEFAULTS.responseProcedures} /></Field>
      <Field label="Emergency procedures"><textarea name="emergencyProcedures" rows={6} defaultValue={plan?.emergencyProcedures ?? BEST_PRACTICE_DEFAULTS.emergencyProcedures} /></Field>
      <Field label="Training and communication"><textarea name="trainingNotes" rows={6} defaultValue={plan?.trainingNotes ?? BEST_PRACTICE_DEFAULTS.trainingNotes} /></Field>
      <Field label="Notification and records"><textarea name="notificationNotes" rows={6} defaultValue={plan?.notificationNotes ?? BEST_PRACTICE_DEFAULTS.notificationNotes} /></Field>
    </div>
    <Field label="Additional plan notes"><textarea name="additionalNotes" rows={4} defaultValue={plan?.additionalNotes ?? BEST_PRACTICE_DEFAULTS.additionalNotes} /></Field>
    <div className="flex items-center gap-3"><button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : plan ? `Save revision ${plan.revision}` : "Create management plan"}</button>{message && <span role="status" className={message === "Management plan saved." ? "text-sm text-teal-dim" : "text-sm text-status-action"}>{message}</span>}</div>
  </form>;
}
