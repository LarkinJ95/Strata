import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ConditionChip, Meta, PageHeader, Panel, SectionTitle } from "@/components/ui/primitives";
import { formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

type InspectionMaterialRow = {
  id: string;
  inventoryItemId: string;
  previousCondition: string | null;
  currentCondition: string | null;
  currentLabel: string | null;
  notes: string | null;
  inventoryCode: string;
  materialDescription: string;
  floor: string | null;
  room: string | null;
};

export default async function InspectionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect("/login");
  const insp = await db.inspection.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      building: { include: { client: true } },
      inspector: true,
      signatures: true,
      discoveries: true,
    },
  });
  if (!insp) notFound();

  // A nested material include creates a parameter list larger than D1 allows
  // for big historical inspections. Keep this as one joined query instead.
  const items = await db.$queryRaw<InspectionMaterialRow[]>(Prisma.sql`
    SELECT
      ii."id" AS "id",
      ii."inventoryItemId" AS "inventoryItemId",
      ii."previousCondition" AS "previousCondition",
      ii."currentCondition" AS "currentCondition",
      ii."currentLabel" AS "currentLabel",
      ii."notes" AS "notes",
      inv."inventoryCode" AS "inventoryCode",
      inv."materialDescription" AS "materialDescription",
      inv."floor" AS "floor",
      inv."room" AS "room"
    FROM "InspectionItem" ii
    INNER JOIN "InventoryItem" inv ON inv."id" = ii."inventoryItemId"
    WHERE ii."inspectionId" = ${id}
    ORDER BY ii."id" ASC
  `);

  return (
    <div>
      <PageHeader
        kicker={insp.building.client.name}
        title={`${insp.building.name} inspection`}
        description={`${insp.inspectionType.replaceAll("_", " ")} · ${formatDate(insp.scheduledDate)} · ${insp.status}`}
        actions={
          <>
            <Link href={`/inspections/${insp.id}/print`} className="btn btn-ghost">Print report</Link>
            {(insp.status === "in_progress" || insp.status === "draft") && (
              <Link href={`/inspections/${insp.id}/field`} className="btn btn-primary">Resume field mode</Link>
            )}
          </>
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <Panel className="p-4"><Meta label="Inspector" value={insp.inspector?.name} /></Panel>
        <Panel className="p-4"><Meta label="Completion" value={`${insp.completionPct}%`} /></Panel>
        <Panel className="p-4"><Meta label="Signed" value={formatDateTime(insp.signedAt)} /></Panel>
        <Panel className="p-4"><Meta label="Findings" value={insp.findings || insp.notes || "—"} /></Panel>
      </div>
      <Panel className="mt-6 overflow-hidden">
        <div className="p-4"><SectionTitle>Inspected materials</SectionTitle></div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>ID</th><th>Material</th><th>Location</th><th>Previous</th><th>Current</th><th>Label</th><th>Notes</th></tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td><Link href={`/inventory/${it.inventoryItemId}`} className="mono-id text-teal-dim">{it.inventoryCode}</Link></td>
                  <td>{it.materialDescription}</td>
                  <td>{it.floor} · {it.room}</td>
                  <td>{it.previousCondition}</td>
                  <td>{it.currentCondition ? <ConditionChip value={it.currentCondition} /> : "—"}</td>
                  <td>{it.currentLabel || "—"}</td>
                  <td className="text-ink-3">{it.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {insp.discoveries.length > 0 && (
        <Panel className="mt-4 p-5">
          <SectionTitle>Newly discovered materials</SectionTitle>
          {insp.discoveries.map((d) => (
            <div key={d.id} className="text-sm">{d.material} · {d.floor} {d.room} · {d.action}</div>
          ))}
        </Panel>
      )}
      {insp.signatures.map((s) => (
        <p key={s.id} className="mt-4 text-sm text-ink-3">Signed by {s.signerName} ({s.signerRole}) on {formatDateTime(s.signedAt)}</p>
      ))}
    </div>
  );
}
