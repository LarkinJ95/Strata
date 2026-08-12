import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, buildingWhere, dataScope } from "@/lib/auth";
import { db } from "@/lib/db";
import { Chip, PageHeader, Panel } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
import { NewSampleForm } from "@/components/forms/new-sample";

export const dynamic = "force-dynamic";

export default async function SamplesPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  const [samples, buildings] = await Promise.all([
    db.sample.findMany({
      where: dataScope(user),
      include: { building: true, layers: { include: { result: true } } },
      orderBy: { collectionDate: "desc" },
    }),
    db.building.findMany({ where: buildingWhere(user), orderBy: { buildingNumber: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        kicker="Laboratory pathway"
        title="Samples"
        description="A sample is not an inventory record. Collect → analyze → review → reconcile."
        actions={<Link href="/samples/reconcile" className="btn btn-primary">Reconcile results</Link>}
      />
      {!user.isClient && (
        <Panel className="mb-4 p-5">
          <NewSampleForm buildings={buildings} />
        </Panel>
      )}
      <Panel className="overflow-hidden">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Sample</th><th>Building</th><th>Material</th><th>Location</th><th>Collected</th><th>Result</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((s) => {
                const layer = s.layers[0];
                const res = layer?.result;
                return (
                  <tr key={s.id}>
                    <td><Link href={`/samples/${s.id}`} className="mono-id text-teal-dim">{s.sampleNumber}</Link></td>
                    <td>{s.building.buildingNumber}</td>
                    <td>{s.material}</td>
                    <td className="text-ink-2">{[s.floor, s.room, s.location].filter(Boolean).join(" · ")}</td>
                    <td>{formatDate(s.collectionDate)}</td>
                    <td>
                      {res ? (res.asbestosDetected ? `${res.asbestosPercent}%` : "ND") : "—"}
                    </td>
                    <td><Chip tone={s.status === "reconciled" ? "ok" : s.status === "at_lab" ? "ice" : "warn"}>{s.status.replaceAll("_", " ")}</Chip></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
