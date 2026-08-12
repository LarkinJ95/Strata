import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { ClientEditor } from "@/components/forms/entity-editors";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.isClient) redirect("/portal");
  const clients = await db.client.findMany({
    where: { organizationId: user.organizationId },
    include: { facilities: { include: { buildings: true } }, _count: { select: { buildings: true, inventoryItems: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader kicker="Portfolio" title="Clients" description="Open a client to edit profile, facilities, and buildings." />
      {!user.isClient && (
        <div className="mb-4">
          <ClientEditor />
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {clients.map((c) => (
          <Link key={c.id} href={`/clients/${c.id}`}>
            <Panel className="p-5">
              <div className="mono-id text-[11px] text-teal-dim">{c.clientNumber}</div>
              <div className="font-display text-xl font-semibold">{c.name}</div>
              <div className="text-sm text-ink-3">{c.city}, {c.state} · {c.primaryContact}</div>
              <div className="mt-3 flex gap-4 text-xs text-ink-3">
                <span>{c.facilities.length} facilities</span>
                <span>{c._count.buildings} buildings</span>
                <span>{c._count.inventoryItems} inventory</span>
              </div>
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}
