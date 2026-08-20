import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Panel, SectionTitle } from "@/components/ui/primitives";
import { AdministrationSettings, OrganizationSettingsForm, ProfileSettingsForm } from "@/components/forms/settings-forms";
import { DataQualityDashboard } from "@/components/data-quality-dashboard";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "profile", label: "My Profile" },
  { id: "organization", label: "Organization" },
  { id: "laboratories", label: "Laboratories" },
  { id: "contractors", label: "Contractors" },
  { id: "regulatory", label: "Regulatory Profiles" },
  { id: "roles", label: "Roles & Permissions" },
  { id: "users", label: "Users" },
  { id: "data-quality", label: "Data Quality" },
] as const;

type SettingsTab = (typeof TABS)[number]["id"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.isClient || user.isContractor) redirect(user.isClient ? "/portal" : "/dashboard");
  const { tab: requestedTab } = await searchParams;
  const tab: SettingsTab = TABS.some((item) => item.id === requestedTab) ? requestedTab as SettingsTab : "profile";
  const [organization, profile, users, roles, labs, contractors, profiles, clients] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId } }),
    db.user.findUniqueOrThrow({ where: { id: user.id } }),
    db.user.findMany({ where: { organizationId: user.organizationId }, include: { role: true, client: true }, orderBy: { name: "asc" } }),
    db.role.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    db.laboratory.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    db.contractor.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    db.regulatoryProfile.findMany({ where: { organizationId: user.organizationId }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
    db.client.findMany({ where: { organizationId: user.organizationId }, select: { id: true, name: true, clientNumber: true }, orderBy: { name: "asc" } }),
  ]);
  const canManageUsers = user.permissions.includes("users.manage");

  const administration = canManageUsers
    ? <AdministrationSettings laboratories={labs} contractors={contractors} regulatoryProfiles={profiles} roles={roles} users={users} clients={clients} activeTab={tab} />
    : <Panel className="p-5"><SectionTitle>Administration</SectionTitle><p className="text-sm text-ink-3">Only organization administrators can configure users, roles, laboratories, contractors, and regulatory profiles.</p></Panel>;

  return <div>
    <PageHeader kicker="Organization" title="Settings" description="Manage your profile, organization, access, and compliance partners." />
    <nav aria-label="Settings sections" className="mb-6 flex gap-2 overflow-x-auto border-b border-[rgba(16,36,72,0.1)] pb-3">
      {TABS.map((item) => <Link key={item.id} href={`/settings?tab=${item.id}`} aria-current={tab === item.id ? "page" : undefined} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${tab === item.id ? "bg-teal text-white" : "bg-white text-ink-3 hover:bg-paper-2"}`}>{item.label}</Link>)}
    </nav>
    <div className="space-y-6">
      {tab === "profile" && <Panel className="p-5"><SectionTitle>My profile</SectionTitle><ProfileSettingsForm user={profile} /></Panel>}
      {tab === "organization" && <Panel className="p-5"><SectionTitle>Organization profile</SectionTitle>{canManageUsers ? <OrganizationSettingsForm organization={organization} /> : <p className="text-sm text-ink-3">Only organization administrators can change company details.</p>}</Panel>}
      {["laboratories", "contractors", "regulatory", "roles", "users"].includes(tab) && administration}
      {tab === "data-quality" && <DataQualityDashboard user={user} />}
    </div>
  </div>;
}
