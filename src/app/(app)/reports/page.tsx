import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PageHeader, Panel } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const REPORTS = [
  { href: "/reports/inventory", title: "Building asbestos inventory", body: "Current inventory with classification, quantity, and primary photograph option." },
  { href: "/reports/inspections", title: "Inspection report", body: "Completed inspections with condition changes and findings." },
  { href: "/reports/repairs", title: "Repair report", body: "Open, verified, and closed response actions." },
  { href: "/reports/samples", title: "Sample / laboratory summary", body: "Collection, methods, layered results." },
  { href: "/reports/actions", title: "Open action items", body: "Overdue inspections, damaged ACM, unreconciled results." },
  { href: "/reports/removed", title: "Removed material report", body: "Partial and complete removals with remaining quantities." },
  { href: "/reports/upcoming", title: "Upcoming & overdue inspections", body: "Surveillance calendar." },
  { href: "/reports/management-plan", title: "Management plan package", body: "Building profile, inventory, history, and responsible parties." },
];

export default async function ReportsPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div>
      <PageHeader kicker="Branded output" title="Reports" description="Choose a report first, then select its scope in the report view." />
      <div className="grid gap-4 md:grid-cols-2">
        {REPORTS.map((r) => (
          <Panel key={r.href} className="p-5">
            <div className="font-display text-lg font-semibold">{r.title}</div>
            <p className="mt-1 text-sm text-ink-3">{r.body}</p>
            <Link href={r.href} className="btn btn-primary mt-3 text-xs">Choose scope</Link>
          </Panel>
        ))}
      </div>
      <div className="mt-4">
        <Link href="/api/export/inventory" className="btn btn-ghost">Download inventory XLSX</Link>
      </div>
    </div>
  );
}
