export const TOKEN_KEY = "strata_session";

export function persistSession(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
  const variants = [
    `strata_client=${token}; Path=/; Max-Age=43200; Secure; SameSite=None; Partitioned`,
    `strata_client=${token}; Path=/; Max-Age=43200; Secure; SameSite=None`,
    `strata_client=${token}; Path=/; Max-Age=43200; SameSite=Lax`,
  ];
  for (const v of variants) {
    try {
      document.cookie = v;
    } catch {
      /* ignore */
    }
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  document.cookie = "strata_client=; Path=/; Max-Age=0; Secure; SameSite=None; Partitioned";
  document.cookie = "strata_client=; Path=/; Max-Age=0; Secure; SameSite=None";
  document.cookie = "strata_client=; Path=/; Max-Age=0; SameSite=Lax";
  document.cookie = "strata_session=; Path=/; Max-Age=0; Secure; SameSite=None; Partitioned";
}

export function readStoredSession() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function withAccess(href: string, token?: string | null) {
  const t = token ?? readStoredSession();
  if (!t) return href;
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return href;
    url.searchParams.set("access", t);
    return url.pathname + url.search + url.hash;
  } catch {
    return href;
  }
}
