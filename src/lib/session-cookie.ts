export const SESSION_COOKIE = "strata_session";

function secureAttributes() {
  return process.env.NODE_ENV === "production"
    ? ["Secure", "SameSite=None", "Partitioned"]
    : ["SameSite=Lax"];
}

export function serializeSessionCookie(token: string, maxAgeSeconds = 12 * 60 * 60) {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    ...secureAttributes(),
  ].join("; ");
}

export function serializeClientSessionCookie(token: string, maxAgeSeconds = 12 * 60 * 60) {
  return [
    `strata_client=${token}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    ...secureAttributes(),
  ].join("; ");
}

export function readSessionToken(cookies: { get: (name: string) => { value: string } | undefined }) {
  return cookies.get(SESSION_COOKIE)?.value || cookies.get("strata_client")?.value || null;
}
