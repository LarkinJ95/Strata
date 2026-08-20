import { NextResponse } from "next/server";
import { saveInspectionItem } from "@/actions/mutations";

/**
 * Drain target for the Field Mode offline queue. A plain endpoint (rather than
 * a server action) so the client can distinguish "rejected" from "never
 * arrived" and keep retrying only the latter.
 */
export async function POST(request: Request) {
  let body: {
    itemId?: string;
    currentCondition?: string;
    currentLabel?: string;
    notes?: string;
    quantityObserved?: number | null;
    materialRemoved?: boolean;
    removedQuantity?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (!body.itemId) return NextResponse.json({ error: "itemId is required." }, { status: 400 });

  try {
    await saveInspectionItem({
      itemId: body.itemId,
      currentCondition: body.currentCondition,
      currentLabel: body.currentLabel,
      notes: body.notes,
      quantityObserved: body.quantityObserved,
      materialRemoved: body.materialRemoved,
      removedQuantity: body.removedQuantity,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save this material.";
    // 4xx means retrying will never help, so the queue drops the record; the
    // client keeps anything that failed for other reasons.
    const status = /not found|not allowed|sign in|required/i.test(message) ? 422 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
