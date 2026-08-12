import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Panel, SectionTitle } from "@/components/ui/primitives";
import { parsePermissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.isClient || user.isContractor) redirect(user.isClient ? "/portal" : "/dashboard");
  const [users, roles, labs, contractors, profiles] = await Promise.all([
    db.user.findMany({ where: { organizationId: user.organizationId }, include: { role: true, client: true } }),
    db.role.findMany({ where: { organizationId: user.organizationId } }),
    db.laboratory.findMany({ where: { organizationId: user.organizationId } }),
    db.contractor.findMany({ where: { organizationId: user.organizationId } }),
    db.regulatoryProfile.findMany({ where: { organizationId: user.organizationId } }),
  ]);

  return (
    <div>
      <PageHeader kicker="Organization" title="Settings" description="Roles are permission sets. Isolation is enforced server-side by organization and client." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-5">
          <SectionTitle>Users</SectionTitle>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Name</th><th>Role</th><th>Scope</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><div className="font-medium">{u.name}</div><div className="text-xs text-ink-3">{u.email}</div></td>
                    <td>{u.role.name}</td>
                    <td>{u.client?.name || "Organization"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel className="p-5">
          <SectionTitle>Roles & permissions</SectionTitle>
          {roles.map((r) => (
            <div key={r.id} className="mb-3">
              <div className="font-medium">{r.name}</div>
              <div className="text-[11px] text-ink-3">{parsePermissions(r.permissions).join(" · ")}</div>
            </div>
          ))}
        </Panel>
        <Panel className="p-5">
          <SectionTitle>Laboratories</SectionTitle>
          {labs.map((l) => <div key={l.id} className="text-sm">{l.name} · {l.accreditation}</div>)}
        </Panel>
        <Panel className="p-5">
          <SectionTitle>Contractors</SectionTitle>
          {contractors.map((c) => <div key={c.id} className="text-sm">{c.name} · {c.license}</div>)}
        </Panel>
        <Panel className="p-5 lg:col-span-2">
          <SectionTitle>Regulatory profiles</SectionTitle>
          {profiles.map((p) => (
            <div key={p.id} className="text-sm">{p.name} · {p.jurisdiction} {p.isDefault ? "(default)" : ""}</div>
          ))}
          <p className="mt-3 text-xs text-ink-3">Inspection frequency, required photographs, and terminology are configurable. The platform is not locked to a single jurisdiction.</p>
        </Panel>
      </div>
    </div>
  );
}
