import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { globalSearch } from "@/actions/mutations";
import { PageHeader, Panel, SectionTitle } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { q } = await searchParams;
  const results = q ? await globalSearch(q) : null;

  return (
    <div>
      <PageHeader kicker="Global search" title={q ? `Results for “${q}”` : "Search"} description="Buildings, inventory IDs, samples, rooms, repairs, and documents." />
      {!results && <Panel className="p-8 text-center text-ink-3">Use the search field in the header.</Panel>}
      {results && (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel className="p-5">
            <SectionTitle>Buildings</SectionTitle>
            {results.buildings.map((b) => (
              <Link key={b.id} href={`/buildings/${b.id}`} className="block py-1">{b.buildingNumber} · {b.name}</Link>
            ))}
            {!results.buildings.length && <p className="text-sm text-ink-3">None</p>}
          </Panel>
          <Panel className="p-5">
            <SectionTitle>Inventory</SectionTitle>
            {results.inventory.map((i) => (
              <Link key={i.id} href={`/inventory/${i.id}`} className="block py-1">{i.inventoryCode} · {i.materialDescription} · {i.building.name}</Link>
            ))}
          </Panel>
          <Panel className="p-5">
            <SectionTitle>Samples</SectionTitle>
            {results.samples.map((s) => (
              <Link key={s.id} href={`/samples/${s.id}`} className="block py-1">{s.sampleNumber} · {s.material}</Link>
            ))}
          </Panel>
          <Panel className="p-5">
            <SectionTitle>Repairs</SectionTitle>
            {results.repairs.map((r) => (
              <Link key={r.id} href={`/repairs/${r.id}`} className="block py-1">{r.repairCode} · {r.problem}</Link>
            ))}
          </Panel>
          <Panel className="p-5 md:col-span-2">
            <SectionTitle>Documents</SectionTitle>
            {results.documents.map((d) => (
              <div key={d.id} className="py-1">{d.name}</div>
            ))}
          </Panel>
        </div>
      )}
    </div>
  );
}
