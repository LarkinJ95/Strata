import { NextResponse } from "next/server";
import { applySessionCookies } from "@/lib/auth";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "strata-dev-secret");

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? "");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  try {
    await jwtVerify(token, secret);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  applySessionCookies(res.headers, token);
  return res;
}
