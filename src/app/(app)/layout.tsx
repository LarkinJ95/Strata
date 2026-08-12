import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/shell";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const unread = await db.notification.count({ where: { userId: user.id, read: false } });
  return (
    <AppShell user={user} unread={unread}>
      {children}
    </AppShell>
  );
}
