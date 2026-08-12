import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Panel, SectionTitle } from "@/components/ui/primitives";
import { AdministrationSettings, OrganizationSettingsForm, ProfileSettingsForm } from "@/components/forms/settings-forms";

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
    <PageHeader kicker="Organization" title="Settings" description="Manage your profile, organization, access, and compliance partners." />
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5"><SectionTitle>My profile</SectionTitle><ProfileSettingsForm user={profile} /></Panel>
        <Panel className="p-5"><SectionTitle>Organization profile</SectionTitle>{canManageUsers ? <OrganizationSettingsForm organization={organization} /> : <p className="text-sm text-ink-3">Only organization administrators can change company details.</p>}</Panel>
      </div>
      {canManageUsers ? <AdministrationSettings laboratories={labs} contractors={contractors} regulatoryProfiles={profiles} roles={roles} users={users} /> : <Panel className="p-5"><SectionTitle>Administration</SectionTitle><p className="text-sm text-ink-3">Only organization administrators can configure users, roles, laboratories, contractors, and regulatory profiles.</p></Panel>}
    </div>
  </div>;
}
