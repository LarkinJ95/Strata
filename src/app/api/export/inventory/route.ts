import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession, dataScope } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.inventoryItem.findMany({
    where: dataScope(user),
    include: { building: { include: { client: true, facility: true } }, homogeneousArea: true },
    orderBy: { inventoryCode: "asc" },
  });
  const data = rows.map((r) => ({
    inventory_id: r.id,
    inventory_code: r.inventoryCode,
    client: r.building.client.name,
    facility: r.building.facility.name,
    building_number: r.building.buildingNumber,
    building: r.building.name,
    floor: r.floor,
    room: r.room,
    location: r.specificLocation,
    material: r.materialDescription,
    category: r.materialCategory,
    homogeneous_area: r.homogeneousArea?.haCode,
    classification: r.acmClassification,
    percent: r.asbestosPercent,
    fiber_types: r.fiberTypes,
    friable: r.friable,
    condition: r.condition,
    original_qty: r.originalQuantity,
    current_qty: r.currentQuantity,
    removed_qty: r.quantityRemoved,
    unit: r.quantityUnit,
    label: r.labelCondition,
    response: r.responseAction,
    status: r.recordStatus,
    provisional: r.isProvisional,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventory");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="strata-inventory.xlsx"',
    },
  });
}
