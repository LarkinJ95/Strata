"use client";

import { useEffect } from "react";

/**
 * Registers the field service worker. Its only job is keeping already-visited
 * pages reachable without signal; if registration fails the app behaves exactly
 * as it did before, so failures are swallowed deliberately.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* Offline support is an enhancement, never a requirement. */
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}
