import { NextResponse } from "next/server";
import { uploadPhoto } from "@/actions/mutations";

function message(error: unknown) {
  return error instanceof Error ? error.message : "Could not upload photograph.";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const formData = await request.formData();
    formData.set("buildingId", id);
    const photo = await uploadPhoto(formData);
    return NextResponse.json({ ok: true, photo });
  } catch (error) {
    const errorMessage = message(error);
    const status = /sign in|required|not allowed|not found/i.test(errorMessage) ? 403 : 400;
    return NextResponse.json({ error: errorMessage }, { status });
  }
}
