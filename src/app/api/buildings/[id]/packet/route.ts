import { NextResponse } from "next/server";
import { assertBuildingAccess, getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildInspectionPacket } from "@/lib/packet-pdf";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const building = await db.building.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      client: true,
      facility: true,
      // Related packet data is loaded below in bounded batches. Nested includes over
      // a large inventory exceed Cloudflare D1's SQL-variable limit.
      inventoryItems: { where: { recordStatus: { in: ["active", "removed"] } }, orderBy: [{ floor: "asc" }, { room: "asc" }, { inventoryCode: "asc" }] },
      floorPlans: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!building || !assertBuildingAccess(user, building)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const org = await db.organization.findUnique({ where: { id: user.organizationId } });
  const query = new URL(req.url).searchParams;
  const chunk = <T,>(values: T[], size = 50) => values.reduce<T[][]>((groups, value, index) => { if (index % size === 0) groups.push([]); groups.at(-1)?.push(value); return groups; }, []);
  const itemIds = building.inventoryItems.map((item) => item.id);
  const functionalAreaIds = [...new Set(building.inventoryItems.map((item) => item.functionalAreaId).filter(Boolean))] as string[];
  const [functionalAreas, sampleLinks, inspectionItems] = await Promise.all([
    Promise.all(chunk(functionalAreaIds).map((ids) => db.buildingArea.findMany({ where: { id: { in: ids } } }))).then((groups) => groups.flat()),
    Promise.all(chunk(itemIds).map((ids) => db.sampleInventoryLink.findMany({ where: { inventoryItemId: { in: ids } }, include: { sample: { select: { sampleNumber: true } } } }))).then((groups) => groups.flat()),
    Promise.all(chunk(itemIds).map((ids) => db.inspectionItem.findMany({ where: { inventoryItemId: { in: ids }, inspection: { status: "completed" } }, include: { inspection: { select: { completedAt: true } } }, orderBy: { inspectedAt: "desc" } }))).then((groups) => groups.flat()),
  ]);
  const areasById = new Map(functionalAreas.map((area) => [area.id, area]));
  const samplesByItemId = new Map<string, typeof sampleLinks>();
  sampleLinks.forEach((link) => samplesByItemId.set(link.inventoryItemId, [...(samplesByItemId.get(link.inventoryItemId) || []), link]));
  const previousByItemId = new Map<string, typeof inspectionItems[number]>();
  inspectionItems.forEach((item) => { const prior = previousByItemId.get(item.inventoryItemId); if (!prior || (item.inspectedAt || item.inspection.completedAt || new Date(0)) > (prior.inspectedAt || prior.inspection.completedAt || new Date(0))) previousByItemId.set(item.inventoryItemId, item); });
  const pdf = await buildInspectionPacket({
    organizationId: user.organizationId,
    name: building.name,
    buildingNumber: building.buildingNumber,
    address: building.address,
    yearConstructed: building.yearConstructed,
    squareFootage: building.squareFootage,
    buildingUse: building.buildingUse,
    lastInspectionAt: building.lastInspectionAt,
    nextInspectionAt: building.nextInspectionAt,
    photoPolicy: building.photoPolicy,
    notes: building.notes,
    client: { name: building.client.name, clientNumber: building.client.clientNumber },
    facility: { name: building.facility.name, facilityId: building.facility.facilityId },
    organizationName: org?.name || user.organizationName,
    organizationAddress: org?.address ?? null,
    inventoryItems: building.inventoryItems.map((item) => ({ ...item, functionalArea: item.functionalAreaId ? areasById.get(item.functionalAreaId) || null : null, sampleLinks: samplesByItemId.get(item.id) || [], inspectionItems: previousByItemId.has(item.id) ? [previousByItemId.get(item.id)!] : [] })),
    floorPlans: building.floorPlans.map((fp) => ({
      name: fp.name,
      storageKey: fp.storageKey,
      mimeType: fp.mimeType,
    })),
  }, { paper: (query.get("paper") as "letter" | "legal" | "a4" | "a3" | null) ?? "letter", orientation: (query.get("orientation") as "portrait" | "landscape" | null) ?? "portrait", density: (query.get("density") as "standard" | "compact" | null) ?? "standard", nestLayers: query.get("nestLayers") !== "false", groupRepeated: query.get("groupRepeated") !== "false", includeFloorPlans: (query.get("includeFloorPlans") ?? query.get("plans")) === "true", includeRemoved: (query.get("includeRemoved") ?? query.get("removed")) === "true", floor: query.get("floor") || undefined, functionalAreaId: query.get("functionalAreaId") || undefined });

  const filename = `${building.name.replace(/[\\/:*?"<>|]/g, "-")} Inspection Packet.pdf`;
  const bytes = new Uint8Array(pdf);
  if (bytes.byteLength < 5 || new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") {
    console.error("Inspection packet generator returned an invalid PDF", { buildingId: building.id, byteLength: bytes.byteLength });
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
  const body = new Blob([bytes], { type: "application/pdf" });
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
