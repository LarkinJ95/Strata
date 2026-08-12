import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canReadStorageKey, getStoredObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key } = await ctx.params;
  const storageKey = key.join("/");
  if (!canReadStorageKey(user.organizationId, storageKey)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const object = await getStoredObject(storageKey);
  if (!object) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("X-Content-Type-Options", "nosniff");
  return new NextResponse(object.body, { headers });
}
