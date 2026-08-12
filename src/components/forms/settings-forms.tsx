"use client";

import { useState, useTransition } from "react";
import { AccessField } from "@/components/forms/access-field";
import { saveContractor, saveLaboratory, saveMyProfile, saveOrganizationSettings, saveRegulatoryProfile, saveRole, saveUser } from "@/actions/settings";
import { PERMISSIONS, parsePermissions } from "@/lib/permissions";

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

type Laboratory = { id: string; name: string; accreditation: string | null; address: string | null; phone: string | null; email: string | null; notes: string | null };
type Contractor = { id: string; name: string; license: string | null; contactName: string | null; phone: string | null; email: string | null; address: string | null; notes: string | null };
type RegulatoryProfile = { id: string; name: string; jurisdiction: string | null; config: string; isDefault: boolean };
type Role = { id: string; name: string; slug: string; description: string | null; permissions: string; isSystem: boolean };
type Member = { id: string; name: string; email: string; title: string | null; phone: string | null; status: string; roleId: string; clientId: string | null };
type Client = { id: string; name: string; clientNumber: string };

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="field"><label>{label}</label>{children}</div>; }
function Editor({ label, children }: { label: string; children: React.ReactNode }) { return <details className="rounded-xl border border-[rgba(16,36,72,0.08)] bg-white/70"><summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-teal-dim">{label}</summary><div className="border-t border-[rgba(16,36,72,0.06)] p-3">{children}</div></details>; }
function Submit({ label }: { label: string }) { return <button className="btn btn-primary" type="submit">{label}</button>; }
function PermissionFields({ selected = [] }: { selected?: string[] }) { return <div className="grid gap-2 sm:grid-cols-2">{PERMISSIONS.map((permission) => <label key={permission} className="flex items-center gap-2 text-xs text-ink-2"><input name="permissions" type="checkbox" value={permission} defaultChecked={selected.includes(permission)} />{permission}</label>)}</div>; }

export function AdministrationSettings({ laboratories, contractors, regulatoryProfiles, roles, users, clients }: { laboratories: Laboratory[]; contractors: Contractor[]; regulatoryProfiles: RegulatoryProfile[]; roles: Role[]; users: Member[]; clients: Client[] }) {
  const config = (raw: string) => { try { return JSON.parse(raw) as { inspectionIntervalDays?: number; requirePhotos?: boolean }; } catch { return {}; } };
  const roleName = (roleId: string) => roles.find((role) => role.id === roleId)?.name || "Unknown role";
  return <div className="space-y-6">
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="panel rounded-2xl p-5"><h2 className="mb-3 font-display text-[15px] font-semibold">Laboratories</h2><div className="space-y-2">{laboratories.map((lab) => <Editor key={lab.id} label={`Edit ${lab.name}`}><form action={saveLaboratory} className="space-y-3"><AccessField /><input type="hidden" name="id" value={lab.id} /><div className="grid gap-3 md:grid-cols-2"><Field label="Name"><input name="name" defaultValue={lab.name} required /></Field><Field label="Accreditation"><input name="accreditation" defaultValue={lab.accreditation ?? ""} /></Field><Field label="Email"><input name="email" type="email" defaultValue={lab.email ?? ""} /></Field><Field label="Phone"><input name="phone" defaultValue={lab.phone ?? ""} /></Field><Field label="Address"><input name="address" defaultValue={lab.address ?? ""} /></Field></div><Field label="Notes"><textarea name="notes" rows={2} defaultValue={lab.notes ?? ""} /></Field><Submit label="Save laboratory" /></form></Editor>)}<Editor label="Add laboratory"><form action={saveLaboratory} className="space-y-3"><AccessField /><div className="grid gap-3 md:grid-cols-2"><Field label="Name"><input name="name" required /></Field><Field label="Accreditation"><input name="accreditation" /></Field><Field label="Email"><input name="email" type="email" /></Field><Field label="Phone"><input name="phone" /></Field><Field label="Address"><input name="address" /></Field></div><Field label="Notes"><textarea name="notes" rows={2} /></Field><Submit label="Add laboratory" /></form></Editor></div></section>
      <section className="panel rounded-2xl p-5"><h2 className="mb-3 font-display text-[15px] font-semibold">Contractors</h2><div className="space-y-2">{contractors.map((contractor) => <Editor key={contractor.id} label={`Edit ${contractor.name}`}><form action={saveContractor} className="space-y-3"><AccessField /><input type="hidden" name="id" value={contractor.id} /><div className="grid gap-3 md:grid-cols-2"><Field label="Company name"><input name="name" defaultValue={contractor.name} required /></Field><Field label="License"><input name="license" defaultValue={contractor.license ?? ""} /></Field><Field label="Contact"><input name="contactName" defaultValue={contractor.contactName ?? ""} /></Field><Field label="Email"><input name="email" type="email" defaultValue={contractor.email ?? ""} /></Field><Field label="Phone"><input name="phone" defaultValue={contractor.phone ?? ""} /></Field><Field label="Address"><input name="address" defaultValue={contractor.address ?? ""} /></Field></div><Field label="Notes"><textarea name="notes" rows={2} defaultValue={contractor.notes ?? ""} /></Field><Submit label="Save contractor" /></form></Editor>)}<Editor label="Add contractor"><form action={saveContractor} className="space-y-3"><AccessField /><div className="grid gap-3 md:grid-cols-2"><Field label="Company name"><input name="name" required /></Field><Field label="License"><input name="license" /></Field><Field label="Contact"><input name="contactName" /></Field><Field label="Email"><input name="email" type="email" /></Field><Field label="Phone"><input name="phone" /></Field><Field label="Address"><input name="address" /></Field></div><Field label="Notes"><textarea name="notes" rows={2} /></Field><Submit label="Add contractor" /></form></Editor></div></section>
    </div>
    <section className="panel rounded-2xl p-5"><h2 className="mb-3 font-display text-[15px] font-semibold">Regulatory profiles</h2><div className="grid gap-3 lg:grid-cols-2">{regulatoryProfiles.map((profile) => { const values = config(profile.config); return <Editor key={profile.id} label={`Edit ${profile.name}${profile.isDefault ? " (default)" : ""}`}><form action={saveRegulatoryProfile} className="space-y-3"><AccessField /><input type="hidden" name="id" value={profile.id} /><div className="grid gap-3 md:grid-cols-2"><Field label="Profile name"><input name="name" defaultValue={profile.name} required /></Field><Field label="Jurisdiction"><input name="jurisdiction" defaultValue={profile.jurisdiction ?? ""} /></Field><Field label="Inspection interval (days)"><input name="inspectionIntervalDays" type="number" min="1" max="3650" defaultValue={values.inspectionIntervalDays ?? 365} required /></Field></div><label className="flex items-center gap-2 text-sm"><input name="requirePhotos" type="checkbox" defaultChecked={values.requirePhotos} /> Require inspection photographs</label><label className="flex items-center gap-2 text-sm"><input name="isDefault" type="checkbox" defaultChecked={profile.isDefault} /> Use as default profile</label><Submit label="Save profile" /></form></Editor>; })}<Editor label="Add regulatory profile"><form action={saveRegulatoryProfile} className="space-y-3"><AccessField /><div className="grid gap-3 md:grid-cols-2"><Field label="Profile name"><input name="name" required /></Field><Field label="Jurisdiction"><input name="jurisdiction" placeholder="Michigan" /></Field><Field label="Inspection interval (days)"><input name="inspectionIntervalDays" type="number" min="1" max="3650" defaultValue="365" required /></Field></div><label className="flex items-center gap-2 text-sm"><input name="requirePhotos" type="checkbox" /> Require inspection photographs</label><label className="flex items-center gap-2 text-sm"><input name="isDefault" type="checkbox" /> Use as default profile</label><Submit label="Add profile" /></form></Editor></div></section>
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="panel rounded-2xl p-5"><h2 className="mb-3 font-display text-[15px] font-semibold">Roles & permissions</h2><div className="space-y-2">{roles.map((role) => role.isSystem ? <div key={role.id} className="rounded-xl border border-[rgba(16,36,72,0.08)] px-3 py-2 text-sm"><span className="font-medium">{role.name}</span><span className="ml-2 text-xs text-ink-3">System role</span></div> : <Editor key={role.id} label={`Edit ${role.name}`}><form action={saveRole} className="space-y-3"><AccessField /><input type="hidden" name="id" value={role.id} /><div className="grid gap-3 md:grid-cols-2"><Field label="Name"><input name="name" defaultValue={role.name} required /></Field><Field label="Role ID"><input name="slug" defaultValue={role.slug} required /></Field></div><Field label="Description"><input name="description" defaultValue={role.description ?? ""} /></Field><PermissionFields selected={parsePermissions(role.permissions)} /><Submit label="Save role" /></form></Editor>)}<Editor label="Add custom role"><form action={saveRole} className="space-y-3"><AccessField /><div className="grid gap-3 md:grid-cols-2"><Field label="Name"><input name="name" required /></Field><Field label="Role ID"><input name="slug" placeholder="site_manager" required /></Field></div><Field label="Description"><input name="description" /></Field><PermissionFields /><Submit label="Add role" /></form></Editor></div></section>
      <section className="panel rounded-2xl p-5"><h2 className="mb-3 font-display text-[15px] font-semibold">Users</h2><p className="mb-3 text-xs text-ink-3">Choose Client Viewer and assign a client to provide a read-only client portal.</p><div className="space-y-2">{users.map((member) => <Editor key={member.id} label={`Edit ${member.name} · ${roleName(member.roleId)}`}><form action={saveUser} className="space-y-3"><AccessField /><input type="hidden" name="id" value={member.id} /><div className="grid gap-3 md:grid-cols-2"><Field label="Name"><input name="name" defaultValue={member.name} required /></Field><Field label="Email"><input name="email" type="email" defaultValue={member.email} required /></Field><Field label="Title"><input name="title" defaultValue={member.title ?? ""} /></Field><Field label="Phone"><input name="phone" defaultValue={member.phone ?? ""} /></Field><Field label="Role"><select name="roleId" defaultValue={member.roleId}>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></Field><Field label="Client access"><select name="clientId" defaultValue={member.clientId ?? ""}><option value="">No client assignment</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.clientNumber} · {client.name}</option>)}</select></Field><Field label="Status"><select name="status" defaultValue={member.status}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field></div><Submit label="Save user" /></form></Editor>)}<Editor label="Add user"><form action={saveUser} className="space-y-3"><AccessField /><div className="grid gap-3 md:grid-cols-2"><Field label="Name"><input name="name" required /></Field><Field label="Email"><input name="email" type="email" required /></Field><Field label="Temporary password"><input name="password" type="password" minLength={12} required /></Field><Field label="Title"><input name="title" /></Field><Field label="Phone"><input name="phone" /></Field><Field label="Role"><select name="roleId" defaultValue={roles.find((role) => role.slug === "client_viewer")?.id || roles[0]?.id}>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></Field><Field label="Client access"><select name="clientId" defaultValue=""><option value="">Select client for Client Viewer</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.clientNumber} · {client.name}</option>)}</select></Field><input type="hidden" name="status" value="active" /></div><Submit label="Create user" /></form></Editor></div></section>
    </div>
  </div>;
}
