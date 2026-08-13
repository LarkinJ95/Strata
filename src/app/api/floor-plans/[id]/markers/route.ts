import { NextResponse } from "next/server";
import { placeFloorPlanMarker } from "@/actions/floor-plan";

function message(error: unknown) {
  return error instanceof Error ? error.message : "Could not save map pin.";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json() as { recordType?: unknown; recordId?: unknown; x?: unknown; y?: unknown };
    if (body.recordType !== "inventory" && body.recordType !== "sample") {
      return NextResponse.json({ error: "Invalid record type." }, { status: 400 });
    }
    const result = await placeFloorPlanMarker({
      floorPlanId: id,
      recordType: body.recordType,
      recordId: String(body.recordId || ""),
      x: Number(body.x),
      y: Number(body.y),
    });
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = message(error);
    const status = /sign in|required|not allowed|not found/i.test(errorMessage) ? 403 : 400;
    return NextResponse.json({ error: errorMessage }, { status });
  }
}
