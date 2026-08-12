import "server-only";
import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { parsePermissions, type Permission } from "./permissions";
import type { SessionUser } from "./types";

export type { SessionUser } from "./types";

export { SESSION_COOKIE } from "./session-cookie";
import { SESSION_COOKIE, serializeSessionCookie, serializeClientSessionCookie } from "./session-cookie";
export function authSecret() {
  const configured = process.env.AUTH_SECRET;
  if (configured) return new TextEncoder().encode(configured);
  if (process.env.NODE_ENV !== "production") return new TextEncoder().encode("strata-dev-secret");
  throw new Error("AUTH_SECRET must be configured in production");
}

export async function sessionCookieOptions(expiresAt: Date) {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    path: "/",
    expires: expiresAt,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    secure: isProduction,
    partitioned: isProduction,
  };
}

export function applySessionCookies(headersOut: Headers, token: string) {
  headersOut.append("Set-Cookie", serializeSessionCookie(token));
  headersOut.append("Set-Cookie", serializeClientSessionCookie(token));
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId, nonce: crypto.randomUUID() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(authSecret());

  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  await db.session.create({ data: { userId, token, expiresAt } }).catch(() => undefined);

  try {
    const jar = await cookies();
    const opts = await sessionCookieOptions(expiresAt);
    jar.set(SESSION_COOKIE, token, opts);
    jar.set("strata_client", token, { ...opts, httpOnly: false });
  } catch {
    /* Preview hosts may reject Partitioned via cookies().set — raw Set-Cookie is applied on the login response. */
  }
  return token;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value || jar.get("strata_client")?.value;
  if (token) {
    await db.session.deleteMany({ where: { token } });
  }
  const opts = { ...(await sessionCookieOptions(new Date(0))), expires: new Date(0), maxAge: 0 };
  jar.set(SESSION_COOKIE, "", opts);
  jar.set("strata_client", "", { ...opts, httpOnly: false });
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const headerStore = await headers();
  const token =
    jar.get(SESSION_COOKIE)?.value ||
    jar.get("strata_client")?.value ||
    headerStore.get("x-strata-session");
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, authSecret());
    const uid = payload.uid as string;
    const session = await db.session.findUnique({ where: { token } }).catch(() => null);
    if (session && session.expiresAt < new Date()) {
      return null;
    }

    const user = await db.user.findUnique({
      where: { id: uid },
      include: {
        role: true,
        organization: true,
        client: true,
        assignedBuildings: true,
      },
    });
    if (!user || user.status !== "active") return null;

    return {
      id: user.id,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      organizationSlug: user.organization.slug,
      clientId: user.clientId,
      clientName: user.client?.name ?? null,
      contractorId: user.contractorId,
      roleSlug: user.role.slug,
      roleName: user.role.name,
      permissions: parsePermissions(user.role.permissions),
      email: user.email,
      name: user.name,
      title: user.title,
      assignedBuildingIds: user.assignedBuildings.map((a) => a.buildingId),
      isClient: Boolean(user.clientId) || user.role.slug.startsWith("client_"),
      isContractor: Boolean(user.contractorId) || user.role.slug === "contractor",
    };
  } catch {
    return null;
  }
}

export async function sessionFromToken(token?: string | null): Promise<SessionUser | null> {
  if (!token) return getSession();
  try {
    const { payload } = await jwtVerify(token, authSecret());
    const uid = payload.uid as string;
    const user = await db.user.findUnique({
      where: { id: uid },
      include: { role: true, organization: true, client: true, assignedBuildings: true },
    });
    if (!user || user.status !== "active") return getSession();
    return {
      id: user.id,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      organizationSlug: user.organization.slug,
      clientId: user.clientId,
      clientName: user.client?.name ?? null,
      contractorId: user.contractorId,
      roleSlug: user.role.slug,
      roleName: user.role.name,
      permissions: parsePermissions(user.role.permissions),
      email: user.email,
      name: user.name,
      title: user.title,
      assignedBuildingIds: user.assignedBuildings.map((a) => a.buildingId),
      isClient: Boolean(user.clientId) || user.role.slug.startsWith("client_"),
      isContractor: Boolean(user.contractorId) || user.role.slug === "contractor",
    };
  } catch {
    return getSession();
  }
}

export async function requireSession(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) {
    throw new Error("UNAUTHENTICATED");
  }
  return s;
}

export function can(user: SessionUser, perm: Permission) {
  return user.permissions.includes(perm);
}

export function orgScope(user: SessionUser) {
  return { organizationId: user.organizationId };
}

export function dataScope(user: SessionUser) {
  const scope: {
    organizationId: string;
    clientId?: string;
    buildingId?: { in: string[] };
  } = { organizationId: user.organizationId };

  if (user.clientId) scope.clientId = user.clientId;
  if (user.isContractor && user.assignedBuildingIds.length) {
    scope.buildingId = { in: user.assignedBuildingIds };
  }
  return scope;
}

export function buildingWhere(user: SessionUser) {
  const scope: {
    organizationId: string;
    clientId?: string;
    id?: { in: string[] };
  } = { organizationId: user.organizationId };
  if (user.clientId) scope.clientId = user.clientId;
  if (user.isContractor && user.assignedBuildingIds.length) {
    scope.id = { in: user.assignedBuildingIds };
  }
  return scope;
}

export function assertBuildingAccess(user: SessionUser, building: { organizationId: string; clientId: string; id: string }) {
  if (building.organizationId !== user.organizationId) return false;
  if (user.clientId && building.clientId !== user.clientId) return false;
  if (user.isContractor && user.assignedBuildingIds.length && !user.assignedBuildingIds.includes(building.id)) {
    return false;
  }
  return true;
}
