import Link from "next/link";
import { redirect } from "next/navigation";
import { dataScope, getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Chip, PageHeader, Panel } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const statuses = ["open", "in_progress", "on_hold"];
export default async function WorkPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await getSession(); if (!user) redirect("/login");
  const sp = await searchParams; const where: Record<string, unknown> = { ...dataScope(user), status: { in: statuses } };
  if (sp.type && ["WO", "PO", "PMO"].includes(sp.type)) where.workType = sp.type;
  if (sp.status && statuses.includes(sp.status)) where.status = sp.status;
  if (sp.priority && ["low", "medium", "high", "critical"].includes(sp.priority)) where.priority = sp.priority;
  if (sp.vendor) where.OR = [{ vendorName: { contains: sp.vendor } }, { contractor: { name: { contains: sp.vendor } } }];
  if (sp.assignee) where.assignedUserId = sp.assignee;
  if (sp.due === "overdue") where.dueDate = { lt: new Date() };
  if (sp.due === "none") where.dueDate = null;
  const [rows, users] = await Promise.all([
    db.workRecord.findMany({ where, include: { building: true, client: true, facility: true, contractor: true, assignedUser: true, _count: { select: { items: true, documents: true } } }, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }] }),
    db.user.findMany({ where: { organizationId: user.organizationId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return <div><PageHeader kicker="Operations" title="Open work" description="Open, in-progress, and on-hold work orders, purchase orders, and PMOs across your accessible buildings." />
    <form className="mb-4 grid gap-2 rounded-xl bg-paper-2 p-3 md:grid-cols-6"><select name="type" defaultValue={sp.type || ""}><option value="">All types</option>{["WO", "PO", "PMO"].map((v) => <option key={v}>{v}</option>)}</select><select name="status" defaultValue={sp.status || ""}><option value="">All open statuses</option>{statuses.map((v) => <option key={v} value={v}>{v.replaceAll("_", " ")}</option>)}</select><select name="priority" defaultValue={sp.priority || ""}><option value="">All priorities</option>{["low", "medium", "high", "critical"].map((v) => <option key={v}>{v}</option>)}</select><select name="assignee" defaultValue={sp.assignee || ""}><option value="">All assignees</option>{users.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select><select name="due" defaultValue={sp.due || ""}><option value="">Any due date</option><option value="overdue">Overdue</option><option value="none">No due date</option></select><input name="vendor" defaultValue={sp.vendor || ""} placeholder="Vendor" /><button className="btn btn-ghost md:col-span-6">Apply filters</button></form>
    <Panel className="overflow-hidden"><div className="table-wrap"><table className="data"><thead><tr><th>Work</th><th>Building</th><th>Type</th><th>Title</th><th>Priority</th><th>Status</th><th>Assignee / vendor</th><th>Due</th><th>Materials</th></tr></thead><tbody>{rows.map((work) => <tr key={work.id}><td><Link className="mono-id text-teal-dim" href={`/work/${work.id}`}>{work.workNumber}</Link></td><td><div>{work.building.buildingNumber}</div><div className="text-xs text-ink-3">{work.client.name} · {work.facility.name}</div></td><td>{work.workType}</td><td>{work.title}</td><td className="capitalize">{work.priority}</td><td><Chip tone={work.status === "on_hold" ? "warn" : "ice"}>{work.status.replaceAll("_", " ")}</Chip></td><td>{work.assignedUser?.name || work.contractor?.name || work.vendorName || "—"}</td><td>{formatDate(work.dueDate)}</td><td>{work._count.items}</td></tr>)}{!rows.length && <tr><td colSpan={9} className="p-6 text-center text-ink-3">No open work matches these filters.</td></tr>}</tbody></table></div></Panel></div>;
}
