import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Chip, Meta, PageHeader, Panel, SectionTitle } from "@/components/ui/primitives";
import { BuildingEditor, ClientEditor, FacilityEditor } from "@/components/forms/entity-editors";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect("/login");
  const client = await db.client.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { facilities: { include: { buildings: true } } },
  });
  if (!client) notFound();

  return (
    <div>
      <div className="crumb mb-3">
        <Link href="/clients">Clients</Link>
        <span> › </span>
        <span className="text-ink">{client.name}</span>
      </div>
      <PageHeader kicker={client.clientNumber} title={client.name} description={`${client.address ?? ""}, ${client.city ?? ""} ${client.state ?? ""}`} />
      <div className="grid gap-4 md:grid-cols-3">
        <Panel className="p-4"><Meta label="Primary contact" value={`${client.primaryContact} · ${client.primaryEmail}`} /></Panel>
        <Panel className="p-4"><Meta label="Photo policy" value={client.photoPolicy} /></Panel>
        <Panel className="p-4"><Meta label="Inspection requirements" value={client.inspectionReqs} /></Panel>
      </div>
      {!user.isClient && (
        <div className="mt-4 space-y-3">
          <ClientEditor client={client} />
          <FacilityEditor clientId={client.id} />
        </div>
      )}
      <div className="mt-6 space-y-4">
        {client.facilities.map((f) => (
          <Panel key={f.id} className="p-5">
            <SectionTitle>{f.name} · {f.facilityId}</SectionTitle>
            <div className="grid gap-3 md:grid-cols-2">
              {f.buildings.map((b) => (
                <Link key={b.id} href={`/buildings/${b.id}`} className="rounded-xl border border-[rgba(16,36,72,0.06)] px-3 py-3 hover:bg-paper-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{b.buildingNumber} · {b.name}</div>
                    <Chip tone={b.complianceStatus === "current" ? "ok" : b.complianceStatus === "attention" ? "warn" : "danger"}>{b.complianceStatus}</Chip>
                  </div>
                  <div className="text-xs text-ink-3">{b.buildingUse} · {b.yearConstructed}</div>
                </Link>
              ))}
            </div>
            {!user.isClient && (
              <div className="mt-3">
                <BuildingEditor facilityId={f.id} />
              </div>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}
