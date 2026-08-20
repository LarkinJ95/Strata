import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { Chip, Meta, Panel, SectionTitle } from "@/components/ui/primitives";
import { BuildingEditor, ClientEditor, FacilityEditor } from "@/components/forms/entity-editors";

export const dynamic = "force-dynamic";

const buildingNumberCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect("/login");
  const client = await db.client.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      facilities: {
        orderBy: { facilityId: "asc" },
        include: { buildings: true },
      },
    },
  });
  if (!client) notFound();
  client.facilities.forEach((facility) => facility.buildings.sort((left, right) => buildingNumberCollator.compare(left.buildingNumber, right.buildingNumber)));

  return (
    <div>
      <div className="crumb mb-3">
        <Link href="/clients">Clients</Link>
        <span> › </span>
        <span className="text-ink">{client.name}</span>
      </div>
      <Panel className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="mono-id text-[11px] text-teal-dim">{client.clientNumber}</div><h1 className="mt-1 font-display text-2xl font-semibold">{client.name}</h1><p className="mt-1 text-sm text-ink-3">{[client.address, client.city, client.state, client.postalCode].filter(Boolean).join(", ") || "Address not recorded"}</p></div>
          <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2"><Meta label="Primary contact" value={[client.primaryContact, client.primaryEmail, client.primaryPhone].filter(Boolean).join(" · ")} /><Meta label="Photo policy" value={client.photoPolicy.replaceAll("_", " ")} /><Meta label="Inspection requirements" value={client.inspectionReqs} /></div>
        </div>
      </Panel>
      {!user.isClient && (
        <div className="mt-4 space-y-3">
          <ClientEditor client={client} />
          <FacilityEditor clientId={client.id} />
        </div>
      )}
      <div className="mt-5 space-y-3">
        {client.facilities.map((f) => (
          <Panel key={f.id} className="p-3">
            <details className="group">
              <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-paper-2">
                <div>
                  <div className="font-display text-[15px] font-semibold tracking-tight">{f.name} · {f.facilityId}</div>
                  <div className="mt-0.5 text-xs text-ink-3">{f.buildings.length} {f.buildings.length === 1 ? "building" : "buildings"}</div>
                </div>
                <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-3 transition-transform group-open:rotate-90" />
              </summary>
              <div className="mt-3 border-t border-[rgba(16,36,72,0.08)] pt-3">
                {!user.isClient && <div className="mb-3"><FacilityEditor clientId={client.id} facility={f} /></div>}
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {f.buildings.map((b) => (
                    (() => {
                      const prefix = `${f.facilityId}-`;
                      const shortNumber = b.buildingNumber.toUpperCase().startsWith(prefix.toUpperCase())
                        ? b.buildingNumber.slice(prefix.length)
                        : b.buildingNumber;
                      return <Link key={b.id} href={`/buildings/${b.id}`} className="rounded-lg border border-[rgba(16,36,72,0.06)] px-2.5 py-2 hover:bg-paper-2">
                        <div className="flex items-center justify-between">
                          <div className="truncate text-sm font-medium">{shortNumber} Building</div>
                          <Chip tone={b.complianceStatus === "current" ? "ok" : b.complianceStatus === "attention" ? "warn" : "danger"}>{b.complianceStatus}</Chip>
                        </div>
                        {(b.buildingUse || b.yearConstructed) && <div className="mt-0.5 truncate text-[11px] text-ink-3">{[b.buildingUse, b.yearConstructed].filter(Boolean).join(" · ")}</div>}
                      </Link>;
                    })()
                  ))}
                </div>
                {!user.isClient && <div className="mt-3"><BuildingEditor facilityId={f.id} /></div>}
              </div>
            </details>
          </Panel>
        ))}
      </div>
    </div>
  );
}
