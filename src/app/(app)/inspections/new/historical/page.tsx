import { redirect } from "next/navigation";
import { buildingWhere, getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { HistoricalInspection } from "@/components/forms/historical-inspection";

export const dynamic = "force-dynamic";
export default async function HistoricalInspectionPage({ searchParams }: { searchParams: Promise<{ building?: string }> }) { const user = await getSession(); if (!user) redirect("/login"); const sp = await searchParams; const buildings = await db.building.findMany({ where: buildingWhere(user), select: { id: true, name: true, buildingNumber: true }, orderBy: { buildingNumber: "asc" } }); const materials = sp.building ? await db.inventoryItem.findMany({ where: { buildingId: sp.building, organizationId: user.organizationId }, select: { id: true, inventoryCode: true, materialDescription: true, floor: true, room: true, condition: true }, orderBy: { inventoryCode: "asc" } }) : []; const newerCount = sp.building ? await db.inspection.count({ where: { buildingId: sp.building, status: "completed" } }) : 0; return <div><PageHeader kicker="Records entry" title="Historical inspection" description="Record a completed inspection from its original performed date without overwriting newer records." /><Panel className="p-5"><HistoricalInspection buildings={buildings} initialBuilding={sp.building} materials={materials} newerCount={newerCount} /></Panel></div>; }
