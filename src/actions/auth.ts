"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) {
    redirect("/login?error=required");
  }

  const user = await db.user.findFirst({
    where: { email, status: "active" },
    include: { role: true },
  });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirect("/login?error=invalid");
  }

  await createSession(user.id);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const dest = next.startsWith("/") && !next.startsWith("//")
    ? next
    : user.role.slug.startsWith("client_")
      ? "/portal"
      : user.role.slug === "contractor"
        ? "/repairs"
        : "/dashboard";
  redirect(dest);
}
