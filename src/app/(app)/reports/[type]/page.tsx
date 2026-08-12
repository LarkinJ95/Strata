import { redirect } from "next/navigation";
import { getSession, buildingWhere } from "@/lib/auth";
import { db } from "@/lib/db";
import { AcmChip, ConditionChip } from "@/components/ui/primitives";
import { formatDate, formatQty } from "@/lib/utils";
import { fileUrl } from "@/lib/files";
import { PrintButton } from "@/components/forms/print-button";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ building?: string }>;
}) {
  const { type } = await params;
  const sp = await searchParams;
  const user = await getSession();
  if (!user) redirect("/login");
  const scope = { ...buildingWhere(user), ...(sp.building ? { id: sp.building } : {}) };
  const org = await db.organization.findUnique({ where: { id: user.organizationId } });
  const buildings = await db.building.findMany({
    where: scope,
    include: {
      client: true,
      facility: true,
      inventoryItems: { include: { photoLinks: { where: { primaryPhoto: true }, include: { photo: true } }, sampleLinks: { include: { sample: true } } } },
      repairs: { include: { inventoryItem: true } },
      samples: { include: { layers: { include: { result: true } } } },
      inspections: { include: { inspector: true }, orderBy: { scheduledDate: "desc" }, take: 5 },
      removals: { include: { inventoryItem: true } },
    },
    orderBy: { buildingNumber: "asc" },
  });
  if (!buildings.length) {
    return <div className="p-10 text-center text-ink-3">No buildings in scope for this report.</div>;
  }

  return (
    <div className="mx-auto max-w-5xl bg-white p-8 print:p-0">
      <div className="no-print mb-4 flex justify-end gap-2">
        <PrintButton />
      </div>
      <header className="border-b border-[rgba(16,36,72,0.12)] pb-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-teal">STRATA · {org?.name}</div>
        <h1 className="font-display text-3xl font-semibold capitalize">{type.replaceAll("-", " ")} report</h1>
        <div className="text-sm text-ink-3">
          Generated {formatDate(new Date())} · Revision 0 · Operational record, not a legal determination
        </div>
      </header>

      {buildings.map((b) => (
        <section key={b.id} className="mt-8 break-inside-avoid">
          <h2 className="font-display text-xl font-semibold">{b.buildingNumber} · {b.name}</h2>
          <p className="text-sm text-ink-3">{b.client.name} · {b.facility.name} · {b.address}</p>

          {(type === "inventory" || type === "management-plan") && (
            <table className="data mt-3">
              <thead>
                <tr>
                  <th>ID</th><th>Material</th><th>Location</th><th>Class</th><th>Cond.</th><th>Qty</th><th>Photo</th>
                </tr>
              </thead>
              <tbody>
                {b.inventoryItems
                  .filter((i) => i.recordStatus === "active" || type === "management-plan")
                  .map((i) => (
                    <tr key={i.id}>
                      <td className="mono-id">{i.inventoryCode}</td>
                      <td>{i.materialDescription}</td>
                      <td>{i.floor} {i.room}</td>
                      <td><AcmChip value={i.acmClassification} /></td>
                      <td><ConditionChip value={i.condition} /></td>
                      <td>{formatQty(i.currentQuantity, i.quantityUnit)}</td>
                      <td>
                        {i.photoLinks[0] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={fileUrl(i.photoLinks[0].photo.storageKey)} alt="" className="h-12 w-16 object-cover" />
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {type === "inspections" && (
            <ul className="mt-3 text-sm">
              {b.inspections.map((i) => (
                <li key={i.id} className="mb-2">
                  {formatDate(i.scheduledDate)} · {i.inspectionType.replaceAll("_", " ")} · {i.status} · {i.inspector?.name} · {i.findings || i.notes}
                </li>
              ))}
            </ul>
          )}

          {type === "repairs" && (
            <ul className="mt-3 text-sm">
              {b.repairs.map((r) => (
                <li key={r.id}>{r.repairCode} · {r.inventoryItem.inventoryCode} · {r.problem} · {r.status}</li>
              ))}
            </ul>
          )}

          {type === "samples" && (
            <ul className="mt-3 text-sm">
              {b.samples.map((s) => (
                <li key={s.id}>
                  {s.sampleNumber} · {s.material} · {s.status} · {s.layers.map((l) => (l.result ? (l.result.asbestosDetected ? `${l.result.asbestosPercent}%` : "ND") : "pending")).join(", ")}
                </li>
              ))}
            </ul>
          )}

          {type === "removed" && (
            <ul className="mt-3 text-sm">
              {b.removals.map((r) => (
                <li key={r.id}>
                  {formatDate(r.removedAt)} · {r.inventoryItem.inventoryCode} · {formatQty(r.quantityRemoved, r.unit)} removed · remaining {formatQty(r.quantityRemaining, r.unit)}
                </li>
              ))}
            </ul>
          )}

          {(type === "actions" || type === "upcoming") && (
            <p className="mt-3 text-sm">Next inspection {formatDate(b.nextInspectionAt)} · operational status {b.complianceStatus}</p>
          )}

          {type === "management-plan" && (
            <div className="mt-3 text-sm leading-6">
              <p>Responsible environmental manager: Northline Environmental. Inspection interval: {b.inspectionIntervalDays} days.</p>
              <p>This plan compiles the current inventory, supporting samples, inspection history, and response actions. Prior revisions are retained.</p>
            </div>
          )}
        </section>
      ))}
      <footer className="mt-12 border-t pt-3 text-[11px] text-ink-3">
        {org?.name} · Page generated by STRATA · Confidential · {org?.address}
      </footer>
    </div>
  );
}
