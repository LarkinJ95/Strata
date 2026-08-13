import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, BookOpenCheck, FileText, ShieldCheck } from "lucide-react";
import { getSession, assertBuildingAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { Chip, Meta, PageHeader, Panel, SectionTitle } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
import { fileUrl } from "@/lib/files";
import { ManagementPlanEditor } from "@/components/forms/management-plan-editor";

export const dynamic = "force-dynamic";

export default async function ManagementPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect("/login");
  const building = await db.building.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      client: true,
      facility: true,
      managementPlans: { orderBy: { revision: "desc" } },
      documents: { where: { docType: "management_plan" }, orderBy: { uploadedAt: "desc" } },
      inventoryItems: { select: { id: true, acmClassification: true, condition: true, recordStatus: true } },
      inspections: { select: { id: true, scheduledDate: true, status: true }, orderBy: { scheduledDate: "desc" }, take: 5 },
      repairs: { select: { id: true, status: true } },
    },
  });
  if (!building || !assertBuildingAccess(user, building)) notFound();
  const plan = building.managementPlans[0];
  const active = building.inventoryItems.filter((item) => item.recordStatus === "active");
  const damaged = active.filter((item) => ["confirmed_acm", "assumed_acm", "pacm"].includes(item.acmClassification) && ["damaged", "significantly_damaged", "needs_repair"].includes(item.condition));
  const openRepairs = building.repairs.filter((repair) => !["closed", "cancelled"].includes(repair.status));
  const reviewOverdue = plan?.reviewDueDate ? plan.reviewDueDate < new Date() : false;

  return <div>
    <PageHeader kicker={`${building.client.name} · ${building.buildingNumber}`} title="Management plan" description="A controlled building record assembled from live inventory, inspections, response actions, and approved plan details." actions={<><Link href={`/reports/management-plan?building=${building.id}`} className="btn btn-ghost">Print package</Link><Link href={`/buildings/${building.id}`} className="btn btn-ghost">Back to building</Link></>} />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Panel className="p-4"><Meta label="Plan status" value={plan ? <Chip tone={plan.status === "approved" && !reviewOverdue ? "ok" : plan.status === "draft" ? "ice" : "warn"}>{reviewOverdue ? "review overdue" : plan.status}</Chip> : <Chip tone="danger">missing</Chip>} /></Panel>
      <Panel className="p-4"><Meta label="Current revision" value={plan ? `Revision ${plan.revision}` : "—"} /></Panel>
      <Panel className="p-4"><Meta label="Review due" value={formatDate(plan?.reviewDueDate)} /></Panel>
      <Panel className="p-4"><Meta label="Responsible person" value={plan?.responsiblePerson} /></Panel>
    </div>
    {(reviewOverdue || !plan || damaged.length || openRepairs.length) && <Panel className="mt-4 border border-[rgba(201,120,22,0.28)] p-4"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 text-status-attention" size={18} /><div><div className="font-semibold">Plan review items</div><div className="mt-1 text-sm text-ink-2">{[!plan && "No management plan has been created", reviewOverdue && "Approved plan review is overdue", damaged.length > 0 && `${damaged.length} damaged ACM material record(s)`, openRepairs.length > 0 && `${openRepairs.length} open response action(s)`].filter(Boolean).join(" · ")}</div></div></div></Panel>}
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Panel className="p-5"><SectionTitle>{plan ? `Revision ${plan.revision} details` : "Create management plan"}</SectionTitle>{user.isClient ? <p className="text-sm text-ink-3">Your organization has not granted editing access to this plan.</p> : <ManagementPlanEditor buildingId={building.id} plan={plan} />}</Panel>
      <div className="space-y-5">
        <Panel className="p-5"><SectionTitle>Live record summary</SectionTitle><div className="space-y-2 text-sm"><div className="stat-row"><span>Active inventory</span><span>{active.length}</span></div><div className="stat-row"><span>Damaged ACM</span><span>{damaged.length}</span></div><div className="stat-row"><span>Open response actions</span><span>{openRepairs.length}</span></div><div className="stat-row"><span>Last inspection</span><span>{formatDate(building.inspections[0]?.scheduledDate)}</span></div></div></Panel>
        <Panel className="p-5"><SectionTitle>Plan documents</SectionTitle>{building.documents.map((document) => <a key={document.id} href={fileUrl(document.storageKey)} target="_blank" rel="noreferrer" className="mb-2 flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-paper-2"><FileText size={15} className="text-teal" /><span className="min-w-0 flex-1 truncate">{document.name}</span><span className="text-xs text-ink-3">{formatDate(document.documentDate ?? document.uploadedAt)}</span></a>)}{!building.documents.length && <p className="text-sm text-ink-3">No signed or supporting management-plan document is attached yet. Upload one from the building Documents tab.</p>}</Panel>
        <Panel className="p-5"><SectionTitle>Included in printed package</SectionTitle><div className="space-y-2 text-sm text-ink-2"><div className="flex gap-2"><ShieldCheck size={16} className="text-teal" />Current inventory and ACM classifications</div><div className="flex gap-2"><BookOpenCheck size={16} className="text-teal" />Current plan details and review dates</div><div className="flex gap-2"><FileText size={16} className="text-teal" />Inspections, response actions, and referenced documents</div></div></Panel>
      </div>
    </div>
  </div>;
}
