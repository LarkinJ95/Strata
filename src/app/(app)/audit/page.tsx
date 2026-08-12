import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.isClient) redirect("/portal");
  const events = await db.auditEvent.findMany({
    where: { organizationId: user.organizationId },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader kicker="Traceability" title="Audit trail" description="Every significant write is retained. History is not deleted when materials change." />
      <Panel className="overflow-hidden">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>When</th><th>User</th><th>Action</th><th>Record</th></tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap">{formatDateTime(e.createdAt)}</td>
                  <td>{e.user?.name}</td>
                  <td className="mono-id">{e.action}</td>
                  <td>{e.recordType} · {e.recordId.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
