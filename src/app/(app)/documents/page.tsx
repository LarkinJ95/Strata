import { redirect } from "next/navigation";
import { getSession, dataScope } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
import { fileUrl } from "@/lib/files";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  const docs = await db.document.findMany({
    where: {
      organizationId: user.organizationId,
      ...(user.clientId ? { clientId: user.clientId } : {}),
      ...(user.isClient ? { visibility: "client" } : {}),
    },
    include: { building: true },
    orderBy: { uploadedAt: "desc" },
  });

  return (
    <div>
      <PageHeader kicker="Record library" title="Documents" description="Surveys, laboratory reports, chains of custody, management plans, and abatement closeout." />
      <Panel className="overflow-hidden">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Document</th><th>Type</th><th>Building</th><th>Date</th><th>Rev</th><th>Visibility</th></tr></thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td><a className="font-medium hover:underline" href={fileUrl(d.storageKey)}>{d.name}</a></td>
                  <td className="capitalize">{d.docType.replaceAll("_", " ")}</td>
                  <td>{d.building?.buildingNumber}</td>
                  <td>{formatDate(d.documentDate)}</td>
                  <td>{d.revision}</td>
                  <td>{d.visibility}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
