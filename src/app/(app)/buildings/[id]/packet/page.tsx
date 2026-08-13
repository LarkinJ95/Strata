import { notFound, redirect } from "next/navigation";
import { getSession, assertBuildingAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { packetPageCount, type PacketOptions } from "@/lib/packet-pdf";

export const dynamic = "force-dynamic";

export default async function PacketPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getSession();
  if (!user) redirect("/login");
  const b = await db.building.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      client: true,
      inventoryItems: { where: { recordStatus: { in: ["active", "removed"] } }, include: { functionalArea: true } },
      floorPlans: true,
    },
  });
  if (!b || !assertBuildingAccess(user, b)) notFound();
  const options: PacketOptions = { paper: (sp.paper as PacketOptions["paper"]) || "letter", orientation: (sp.orientation as PacketOptions["orientation"]) || "portrait", density: (sp.density as PacketOptions["density"]) || "standard", nestLayers: sp.nestLayers !== "false", groupRepeated: false, includeFloorPlans: (sp.includeFloorPlans ?? sp.plans) === "true", includeRemoved: (sp.includeRemoved ?? sp.removed) === "true", floor: sp.floor || undefined, functionalAreaId: sp.functionalAreaId || undefined };
  const pages = packetPageCount(b.inventoryItems, options, b.floorPlans.length);
  const floors = [...new Set(b.inventoryItems.map((item) => item.floor).filter(Boolean))] as string[];
  const functionalAreas = [...new Map(b.inventoryItems.flatMap((item) => item.functionalArea ? [[item.functionalArea.id, item.functionalArea]] : [])).values()];
  const query = new URLSearchParams(Object.entries(options).reduce<Record<string, string>>((out, [key, value]) => { if (value !== undefined) out[key] = String(value); return out; }, {})).toString();

  return (
    <div>
      <PageHeader
        kicker="Field packet"
        title={`${b.buildingNumber} inspection packet`}
        description="A compact field checklist with a code key, write-in condition cells, field-notes lane, and optional floor plans."
      />
      <Panel className="p-6">
        <div className="text-sm text-ink-2">
          {b.client.name} · {b.inventoryItems.filter((item) => item.recordStatus === "active").length} active materials · {b.floorPlans.length} floor plan{b.floorPlans.length === 1 ? "" : "s"}
        </div>
        <div className="mt-4 rounded-xl bg-teal-soft p-3 text-sm"><b>{pages} pages</b> · {b.inventoryItems.length} items · {options.nestLayers ? "layers nested" : "individual layers"} · {options.density} density · {options.paper} {options.orientation}</div>
        <form className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="field"><span>Paper</span><select name="paper" defaultValue={options.paper}><option value="letter">Letter</option><option value="legal">Legal</option><option value="a4">A4</option><option value="a3">A3</option></select></label>
          <label className="field"><span>Orientation</span><select name="orientation" defaultValue={options.orientation}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
          <label className="field"><span>Density</span><select name="density" defaultValue={options.density}><option value="standard">Standard</option><option value="compact">Compact</option></select></label>
          <label className="flex items-center gap-2 text-sm"><input type="hidden" name="nestLayers" value="false" /><input name="nestLayers" type="checkbox" value="true" defaultChecked={options.nestLayers} /> Nest layers</label>
          <label className="flex items-center gap-2 text-sm"><input type="hidden" name="plans" value="false" /><input name="plans" type="checkbox" value="true" defaultChecked={options.includeFloorPlans} /> Include floor plans</label>
          <label className="flex items-center gap-2 text-sm"><input type="hidden" name="removed" value="false" /><input name="removed" type="checkbox" value="true" defaultChecked={options.includeRemoved} /> Include removed items</label>
          <label className="field"><span>Scope to floor</span><select name="floor" defaultValue={options.floor || ""}><option value="">All floors</option>{floors.map((floor) => <option key={floor} value={floor}>{floor}</option>)}</select></label>
          <label className="field"><span>Scope to functional area</span><select name="functionalAreaId" defaultValue={options.functionalAreaId || ""}><option value="">All functional areas</option>{functionalAreas.map((area) => <option key={area.id} value={area.id}>{area.faCode ? `${area.faCode} · ` : ""}{area.name}</option>)}</select></label>
          <button className="btn btn-ghost w-fit">Update preview</button>
        </form>
        <ul className="mt-3 text-sm text-ink-3">
          {b.floorPlans.map((fp) => (
            <li key={fp.id}>· {fp.name}</li>
          ))}
          {!b.floorPlans.length && <li>No drawings uploaded yet — the packet will still include inventory forms.</li>}
        </ul>
        <a href={`/api/buildings/${b.id}/packet?${query}`} download={`${b.name} Inspection Packet.pdf`} className="btn btn-primary mt-5">
          Download PDF packet
        </a>
      </Panel>
    </div>
  );
}
