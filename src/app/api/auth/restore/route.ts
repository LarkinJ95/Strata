import { NextResponse } from "next/server";
import { applySessionCookies, authSecret } from "@/lib/auth";
import { jwtVerify } from "jose";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { token?: unknown } | null;
  const token = String(body?.token ?? "");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  try {
    await jwtVerify(token, authSecret());
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  applySessionCookies(res.headers, token);
  return res;
}
