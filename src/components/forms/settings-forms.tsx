"use client";

import { useState, useTransition } from "react";
import { AccessField } from "@/components/forms/access-field";
import { saveMyProfile, saveOrganizationSettings } from "@/actions/settings";

function SaveButton({ pending, label }: { pending: boolean; label: string }) {
  return <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : label}</button>;
}

export function ProfileSettingsForm({ user }: { user: { name: string; title: string | null; phone: string | null; email: string } }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return (
    <form className="space-y-4" action={(form) => start(async () => {
      setMessage("");
      try { await saveMyProfile(form); setMessage("Profile saved."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save profile."); }
    })}>
      <AccessField />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="field"><label>Name</label><input name="name" defaultValue={user.name} required /></div>
        <div className="field"><label>Email</label><input value={user.email} disabled /></div>
        <div className="field"><label>Job title</label><input name="title" defaultValue={user.title ?? ""} placeholder="Environmental manager" /></div>
        <div className="field"><label>Phone</label><input name="phone" defaultValue={user.phone ?? ""} placeholder="(555) 555-5555" /></div>
      </div>
      <div className="flex items-center gap-3"><SaveButton pending={pending} label="Save profile" />{message && <span className="text-sm text-ink-3">{message}</span>}</div>
    </form>
  );
}

export function OrganizationSettingsForm({ organization }: { organization: { name: string; legalName: string | null; address: string | null; phone: string | null; email: string | null; website: string | null; slug: string } }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return (
    <form className="space-y-4" action={(form) => start(async () => {
      setMessage("");
      try { await saveOrganizationSettings(form); setMessage("Organization settings saved."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save organization settings."); }
    })}>
      <AccessField />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="field"><label>Organization name</label><input name="organizationName" defaultValue={organization.name} required /></div>
        <div className="field"><label>Legal name</label><input name="legalName" defaultValue={organization.legalName ?? ""} /></div>
        <div className="field"><label>General email</label><input name="organizationEmail" type="email" defaultValue={organization.email ?? ""} /></div>
        <div className="field"><label>General phone</label><input name="organizationPhone" defaultValue={organization.phone ?? ""} /></div>
        <div className="field md:col-span-2"><label>Street address</label><input name="address" defaultValue={organization.address ?? ""} /></div>
        <div className="field"><label>Website</label><input name="website" type="url" defaultValue={organization.website ?? ""} placeholder="https://example.com" /></div>
        <div className="field"><label>Organization ID</label><input value={organization.slug} disabled /></div>
      </div>
      <div className="flex items-center gap-3"><SaveButton pending={pending} label="Save organization" />{message && <span className="text-sm text-ink-3">{message}</span>}</div>
    </form>
  );
}
