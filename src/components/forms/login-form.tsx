"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { persistSession, readStoredSession } from "@/lib/session-client";

export function LoginForm() {
  const params = useSearchParams();
  const error = params.get("error");

  useEffect(() => {
    const existing = readStoredSession();
    const next = params.get("next") || "/dashboard";
    if (existing && !error) {
      persistSession(existing);
      window.location.replace(`${next}${next.includes("?") ? "&" : "?"}access=${encodeURIComponent(existing)}`);
    }
  }, [error, params]);

  return null;
}
