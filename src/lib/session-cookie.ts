export const SESSION_COOKIE = "strata_session";

export function serializeSessionCookie(token: string, maxAgeSeconds = 12 * 60 * 60) {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Partitioned",
  ].join("; ");
}

export function serializeClientSessionCookie(token: string, maxAgeSeconds = 12 * 60 * 60) {
  return [
    `strata_client=${token}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "Secure",
    "SameSite=None",
    "Partitioned",
  ].join("; ");
}

export function readSessionToken(cookies: { get: (name: string) => { value: string } | undefined }) {
  return cookies.get(SESSION_COOKIE)?.value || cookies.get("strata_client")?.value || null;
}
