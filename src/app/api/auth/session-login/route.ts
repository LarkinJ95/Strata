import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applySessionCookies, createSession, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const form = await req.formData().catch(() => null);
    const email = String(form?.get("email") ?? "").trim().toLowerCase();
    const password = String(form?.get("password") ?? "");
    const next = String(form?.get("next") ?? "");

    if (!email || !password) {
      return NextResponse.redirect(new URL("/login?error=required", req.url), 303);
    }

    const user = await db.user.findFirst({
      where: { email, status: "active" },
      include: { role: true },
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.redirect(new URL("/login?error=invalid", req.url), 303);
    }

    const token = await createSession(user.id);
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => undefined);

    const dest =
      next.startsWith("/") && !next.startsWith("//")
        ? next
        : user.role.slug.startsWith("client_")
          ? "/portal"
          : user.role.slug === "contractor"
            ? "/inspections"
            : "/dashboard";

    const res = NextResponse.redirect(new URL(dest, req.url), 303);
    applySessionCookies(res.headers, token);
    return res;
  } catch (err) {
    console.error("session-login failed", err);
    return NextResponse.redirect(new URL("/login?error=invalid", req.url), 303);
  }
}
