import { NextResponse } from "next/server";
import { assertBuildingAccess, getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildInspectionPacket } from "@/lib/packet-pdf";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const building = await db.building.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      client: true,
      facility: true,
      inventoryItems: { where: { recordStatus: "active" }, orderBy: { inventoryCode: "asc" } },
      floorPlans: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!building || !assertBuildingAccess(user, building)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const org = await db.organization.findUnique({ where: { id: user.organizationId } });
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
  });

  const filename = `${building.buildingNumber}-inspection-packet.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
