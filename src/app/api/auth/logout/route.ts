import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { serializeClientSessionCookie, serializeSessionCookie } from "@/lib/session-cookie";

export async function POST() {
  await destroySession();
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", serializeSessionCookie("", 0));
  res.headers.append("Set-Cookie", serializeClientSessionCookie("", 0));
  return res;
}
