import { NextResponse } from "next/server";
import { uploadBuildingDocument } from "@/actions/mutations";

function message(error: unknown) {
  return error instanceof Error ? error.message : "Could not upload document.";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const formData = await request.formData();
    formData.set("buildingId", id);
    const document = await uploadBuildingDocument(formData);
    return NextResponse.json({ ok: true, document });
  } catch (error) {
    const errorMessage = message(error);
    const status = /sign in|required|not allowed|not found/i.test(errorMessage) ? 403 : 400;
    return NextResponse.json({ error: errorMessage }, { status });
  }
}
