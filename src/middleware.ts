import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { serializeClientSessionCookie, serializeSessionCookie } from "@/lib/session-cookie";

const PUBLIC = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/restore",
  "/api/auth/session-login",
  "/api/health",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/demo") ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon.svg" ||
    pathname === "/favicon.png" ||
    pathname === "/favicon-64.png" ||
    pathname === "/apple-touch-icon.png" ||
    pathname === "/strata-logo.png"
  ) {
    return NextResponse.next();
  }

  const fromQuery = req.nextUrl.searchParams.get("access");
  const token =
    fromQuery ||
    req.cookies.get("strata_session")?.value ||
    req.cookies.get("strata_client")?.value ||
    req.headers.get("x-strata-session");

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.delete("access");
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-strata-session", token);

  if (fromQuery) {
    const clean = req.nextUrl.clone();
    clean.searchParams.delete("access");
    const res = NextResponse.rewrite(clean, { request: { headers: requestHeaders } });
    res.headers.append("Set-Cookie", serializeSessionCookie(token));
    res.headers.append("Set-Cookie", serializeClientSessionCookie(token));
    return res;
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|demo/).*)"],
};
