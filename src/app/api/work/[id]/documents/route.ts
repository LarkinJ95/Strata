import { NextResponse } from "next/server";
import { uploadWorkDocument } from "@/actions/work";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { const form = await request.formData(); form.set("workRecordId", id); return NextResponse.json({ ok: true, document: await uploadWorkDocument(form) }); }
  catch (error) { const message = error instanceof Error ? error.message : "Could not upload document."; return NextResponse.json({ error: message }, { status: /not allowed|not found|sign in/i.test(message) ? 403 : 400 }); }
}
