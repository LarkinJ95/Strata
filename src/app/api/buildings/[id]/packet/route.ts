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
      inventoryItems: { where: { recordStatus: { in: ["active", "removed"] } }, include: { functionalArea: true, sampleLinks: { include: { sample: { select: { sampleNumber: true } } } }, inspectionItems: { include: { inspection: { select: { completedAt: true } } }, where: { inspection: { status: "completed" } }, orderBy: { inspectedAt: "desc" }, take: 1 } }, orderBy: [{ floor: "asc" }, { room: "asc" }, { inventoryCode: "asc" }] },
      floorPlans: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!building || !assertBuildingAccess(user, building)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const org = await db.organization.findUnique({ where: { id: user.organizationId } });
  const query = new URL(req.url).searchParams;
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
    inventoryItems: building.inventoryItems,
    floorPlans: building.floorPlans.map((fp) => ({
      name: fp.name,
      storageKey: fp.storageKey,
      mimeType: fp.mimeType,
    })),
  }, { paper: (query.get("paper") as "letter" | "legal" | "a4" | "a3" | null) ?? "letter", orientation: (query.get("orientation") as "portrait" | "landscape" | null) ?? "portrait", density: (query.get("density") as "standard" | "compact" | null) ?? "standard", nestLayers: query.get("nestLayers") !== "false", groupRepeated: query.get("groupRepeated") !== "false", includeFloorPlans: query.get("plans") !== "false", includeRemoved: query.get("removed") === "true", floor: query.get("floor") || undefined, functionalAreaId: query.get("functionalAreaId") || undefined });

  const filename = `${building.name.replace(/[\\/:*?"<>|]/g, "-")} Inspection Packet.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Length": String(pdf.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
