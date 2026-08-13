"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, ClipboardCheck, LayoutDashboard, LogOut, Settings, Users, ListChecks } from "lucide-react";
import { useTransition } from "react";
import type { SessionUser } from "@/lib/types";
import { clearSession } from "@/lib/session-client";
import { cn, initials } from "@/lib/utils";
import { GlobalSearch } from "@/components/layout/global-search";

const STAFF_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/queue", label: "Compliance Queue", icon: AlertTriangle },
  { href: "/quality", label: "Data Quality", icon: ListChecks },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/inspections", label: "Inspector Workspace", icon: ClipboardCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

const PORTAL_NAV = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Buildings", icon: Users },
  { href: "/inspections", label: "Inspections", icon: ClipboardCheck },
];

export function AppShell({
  user,
  children,
  unread = 0,
}: {
  user: SessionUser;
  children: React.ReactNode;
  unread?: number;
}) {
  const path = usePathname();
  const fieldMode = path.includes("/field");
  const [pending, start] = useTransition();
  const items = user.isClient
    ? PORTAL_NAV
    : user.isContractor
      ? STAFF_NAV.filter((n) => n.href === "/inspections")
      : STAFF_NAV;

  async function logout() {
    start(async () => {
      clearSession();
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      window.location.assign("/login");
    });
  }

  return (
    <div className="min-h-screen bg-grid">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col border-r border-[rgba(16,36,72,0.08)] bg-white/80 px-3 py-4 backdrop-blur-xl lg:flex",
          fieldMode && "!hidden"
        )}
      >
        <Link href={user.isClient ? "/portal" : "/dashboard"} className="mb-7 block px-2">
          <img src="/strata-logo.png" alt="STRATA" className="h-auto w-[154px]" />
        </Link>

        <nav className="flex-1 space-y-0.5">
          {items.map((item) => {
            const active = path === item.href || path.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={cn("sidebar-link", active && "active")}>
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="rounded-xl border border-[rgba(16,36,72,0.08)] bg-white/80 p-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-teal-soft text-[11px] font-semibold text-teal-dim">
              {initials(user.name)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold">{user.name}</div>
              <div className="truncate text-[10px] uppercase tracking-wider text-ink-3">{user.roleName}</div>
            </div>
          </div>
          {unread > 0 && <div className="mt-2 text-[11px] text-teal-dim">{unread} new</div>}
          <button onClick={logout} disabled={pending} className="btn btn-ghost mt-3 w-full text-xs">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>

      <div className={cn(!fieldMode && "lg:pl-[232px]")}>
        {!fieldMode && (
          <div className="sticky top-0 z-20 border-b border-[rgba(16,36,72,0.08)] bg-[#f1f5fa]/90 px-4 py-2.5 backdrop-blur-xl md:px-6">
            <GlobalSearch />
          </div>
        )}
        <main className="px-4 py-4 md:px-6">{children}</main>
      </div>
    </div>
  );
}
