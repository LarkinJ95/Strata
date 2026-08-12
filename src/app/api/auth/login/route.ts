import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applySessionCookies, createSession, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const user = await db.user.findFirst({
    where: { email, status: "active" },
    include: { role: true },
  });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const token = await createSession(user.id);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const dest = user.role.slug.startsWith("client_")
    ? "/portal"
    : user.role.slug === "contractor"
      ? "/repairs"
      : "/dashboard";

  const res = NextResponse.json({ ok: true, dest, token });
  applySessionCookies(res.headers, token);
  return res;
}
