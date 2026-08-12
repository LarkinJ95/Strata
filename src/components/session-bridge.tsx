"use client";

import { useEffect } from "react";
import { persistSession, readStoredSession, withAccess } from "@/lib/session-client";

export function SessionBridge() {
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("access");
    if (fromUrl) persistSession(fromUrl);
    const token = fromUrl || readStoredSession();
    if (token) persistSession(token);

    function onClick(e: MouseEvent) {
      const t = readStoredSession();
      if (!t) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.searchParams.has("access")) return;
      e.preventDefault();
      e.stopPropagation();
      const next = withAccess(url.pathname + url.search + url.hash, t);
      if (a.target === "_blank") window.open(next, "_blank", "noopener");
      else window.location.assign(next);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
