import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Panel, SectionTitle, Empty } from "@/components/ui/primitives";
import { parsePermissions } from "@/lib/permissions";
import { OrganizationSettingsForm, ProfileSettingsForm } from "@/components/forms/settings-forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.isClient || user.isContractor) redirect(user.isClient ? "/portal" : "/dashboard");
  const [organization, profile, users, roles, labs, contractors, profiles] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId } }),
    db.user.findUniqueOrThrow({ where: { id: user.id } }),
    db.user.findMany({ where: { organizationId: user.organizationId }, include: { role: true, client: true }, orderBy: { name: "asc" } }),
    db.role.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    db.laboratory.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    db.contractor.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    db.regulatoryProfile.findMany({ where: { organizationId: user.organizationId }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
  ]);
  const canManageUsers = user.permissions.includes("users.manage");

  return <div>
    <PageHeader kicker="Organization" title="Settings" description="Manage your profile, organization details, access roles, and compliance partners." />
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5"><SectionTitle>My profile</SectionTitle><ProfileSettingsForm user={profile} /></Panel>
        <Panel className="p-5"><SectionTitle>Organization profile</SectionTitle>{canManageUsers ? <OrganizationSettingsForm organization={organization} /> : <p className="text-sm text-ink-3">Only organization administrators can change company details.</p>}</Panel>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5"><SectionTitle>Users <span className="text-ink-3">({users.length})</span></SectionTitle><div className="table-wrap"><table className="data"><thead><tr><th>Name</th><th>Role</th><th>Scope</th></tr></thead><tbody>{users.map((member) => <tr key={member.id}><td><div className="font-medium">{member.name}</div><div className="text-xs text-ink-3">{member.email}</div></td><td>{member.role.name}</td><td>{member.client?.name || "Organization"}</td></tr>)}</tbody></table></div></Panel>
        <Panel className="p-5"><SectionTitle>Roles & permissions</SectionTitle><div className="space-y-4">{roles.map((role) => <div key={role.id}><div className="font-medium">{role.name}{role.isSystem && <span className="ml-2 text-xs text-ink-3">System role</span>}</div><div className="mt-1 text-xs leading-5 text-ink-3">{parsePermissions(role.permissions).join(" · ") || "No permissions assigned"}</div></div>)}</div></Panel>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5"><SectionTitle>Laboratories</SectionTitle>{labs.length ? <div className="space-y-2">{labs.map((lab) => <div key={lab.id} className="rounded-xl border border-[rgba(16,36,72,0.06)] px-3 py-2 text-sm"><div className="font-medium">{lab.name}</div><div className="text-xs text-ink-3">{lab.accreditation || "Accreditation not recorded"}</div></div>)}</div> : <Empty title="No laboratories configured" body="Laboratories will appear here when they are added to your organization." />}</Panel>
        <Panel className="p-5"><SectionTitle>Contractors</SectionTitle>{contractors.length ? <div className="space-y-2">{contractors.map((contractor) => <div key={contractor.id} className="rounded-xl border border-[rgba(16,36,72,0.06)] px-3 py-2 text-sm"><div className="font-medium">{contractor.name}</div><div className="text-xs text-ink-3">{contractor.license || "License not recorded"}</div></div>)}</div> : <Empty title="No contractors configured" body="Contractors will appear here when they are added to your organization." />}</Panel>
      </div>
      <Panel className="p-5"><SectionTitle>Regulatory profiles</SectionTitle>{profiles.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{profiles.map((regulatory) => <div key={regulatory.id} className="rounded-xl border border-[rgba(16,36,72,0.06)] px-3 py-2 text-sm"><div className="font-medium">{regulatory.name}{regulatory.isDefault && <span className="ml-2 text-xs text-teal-dim">Default</span>}</div><div className="text-xs text-ink-3">{regulatory.jurisdiction}</div></div>)}</div> : <Empty title="No regulatory profiles configured" body="Create a profile to define inspection requirements for your organization." />}</Panel>
    </div>
  </div>;
}
