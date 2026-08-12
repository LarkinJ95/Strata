import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { Chip, Meta, PageHeader, Panel, SectionTitle } from "@/components/ui/primitives";
import { PhotoThumb } from "@/components/records";
import { formatDate, formatNumber } from "@/lib/utils";
import { RepairStatusButtons } from "@/components/forms/actions-ui";
import { VerifyRepairForm } from "@/components/forms/verify-repair";
import { PhotoUpload } from "@/components/forms/photo-upload";

export const dynamic = "force-dynamic";

export default async function RepairDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect("/login");
  const repair = await db.repair.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      building: { include: { client: true } },
      inventoryItem: true,
      contractor: true,
      assignedUser: true,
      verification: true,
      photoLinks: { include: { photo: true } },
      documents: true,
    },
  });
  if (!repair) notFound();
  const groups = {
    before: repair.photoLinks.filter((p) => p.category === "before"),
    during: repair.photoLinks.filter((p) => p.category === "during"),
    after: repair.photoLinks.filter((p) => p.category === "after"),
    verification: repair.photoLinks.filter((p) => p.category === "verification"),
  };

  return (
    <div>
      <PageHeader
        kicker={`${repair.building.client.name} · ${repair.building.name}`}
        title={repair.repairCode}
        description={repair.problem}
        actions={<Link href={`/inventory/${repair.inventoryItemId}`} className="btn btn-ghost">{repair.inventoryItem.inventoryCode}</Link>}
      />
      <div className="flex flex-wrap gap-2">
        <Chip tone={repair.status === "closed" ? "ok" : "warn"}>{repair.status.replaceAll("_", " ")}</Chip>
        <Chip tone="danger">{repair.priority}</Chip>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <Panel className="p-4"><Meta label="Identified" value={formatDate(repair.identifiedAt)} /></Panel>
        <Panel className="p-4"><Meta label="Scheduled" value={formatDate(repair.scheduledDate)} /></Panel>
        <Panel className="p-4"><Meta label="Contractor" value={repair.contractor?.name} /></Panel>
        <Panel className="p-4"><Meta label="Work order" value={repair.workOrderNumber} /></Panel>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel className="p-5">
          <SectionTitle>Work record</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Meta label="PO" value={repair.poNumber} />
            {!user.isClient && <Meta label="Estimated cost" value={repair.estimatedCost != null ? `$${formatNumber(repair.estimatedCost)}` : "—"} />}
            <Meta label="Completed" value={formatDate(repair.completionDate)} />
            <Meta label="Assigned" value={repair.assignedUser?.name} />
          </div>
          <p className="mt-3 text-sm text-ink-2">{repair.completionNotes}</p>
          {!user.isClient && (
            <div className="mt-4">
              <div className="mb-2 text-[11px] uppercase tracking-wider text-ink-3">Advance status</div>
              <RepairStatusButtons id={repair.id} />
            </div>
          )}
        </Panel>
        <Panel className="p-5">
          <SectionTitle>Verification</SectionTitle>
          {repair.verification ? (
            <div className="space-y-2 text-sm">
              <Meta label="Satisfactory" value={repair.verification.satisfactory ? "Yes" : "No"} />
              <Meta label="Updated condition" value={repair.verification.updatedCondition} />
              <Meta label="Notes" value={repair.verification.notes} />
            </div>
          ) : (
            <p className="text-sm text-ink-3">Contractor completion does not close this repair. Environmental verification is required.</p>
          )}
          {can(user, "repairs.verify") && repair.status !== "closed" && (
            <div className="mt-4"><VerifyRepairForm repairId={repair.id} /></div>
          )}
        </Panel>
      </div>
      <Panel className="mt-6 p-5">
        <SectionTitle>Before → During → After → Verification</SectionTitle>
        <div className="grid gap-4 md:grid-cols-4">
          {(["before", "during", "after", "verification"] as const).map((g) => (
            <div key={g}>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">{g}</div>
              <div className="space-y-2">
                {groups[g].map((l) => <PhotoThumb key={l.id} storageKey={l.photo.storageKey} caption={l.caption} />)}
                {!groups[g].length && <div className="rounded-xl bg-paper-2 p-6 text-center text-xs text-ink-4">No photos</div>}
              </div>
            </div>
          ))}
        </div>
        {!user.isClient && repair.building.photoPolicy !== "prohibited" && (
          <div className="mt-4"><PhotoUpload buildingId={repair.buildingId} recordType="repair" recordId={repair.id} /></div>
        )}
      </Panel>
    </div>
  );
}
