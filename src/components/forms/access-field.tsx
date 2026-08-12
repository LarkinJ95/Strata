"use client";

import { useEffect, useState } from "react";

export function AccessField() {
  const [token, setToken] = useState("");
  useEffect(() => {
    try {
      setToken(localStorage.getItem("strata_session") || new URLSearchParams(location.search).get("access") || "");
    } catch {
      /* ignore */
    }
  }, []);
  return <input type="hidden" name="access" value={token} />;
}

export function Disclose({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="rounded-xl border border-[rgba(16,36,72,0.08)] bg-white/70">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-teal-dim">{label}</summary>
      <div className="border-t border-[rgba(16,36,72,0.06)] p-3">{children}</div>
    </details>
  );
}
