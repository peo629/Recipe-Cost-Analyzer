import crypto from "crypto";
import { type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { db, sessionsTable, usersTable, type User } from "@workspace/db";
import { LoginResponse } from "@workspace/api-zod";

export type AuthUser = z.infer<typeof LoginResponse>["user"];
type AuthUserPermission = AuthUser["permissions"][number];

/**
 * Authoritative allowlist of permission strings. Mirrors the
 * `AuthUser.permissions[]` enum in `lib/api-spec/openapi.yaml`.
 *
 * Kept as an explicit `as const` tuple (not introspected from a Zod
 * schema) so the type system can verify it stays in sync with
 * `AuthUserPermission`: if the OpenAPI enum gains or loses a value,
 * the typed `satisfies readonly AuthUserPermission[]` check below will
 * fail to compile until this constant is updated.
 */
const PERMISSION_VALUES = [
  "admin",
  "executive",
  "venue_manager",
  "supervisor",
  "staff",
  "viewer",
] as const satisfies readonly AuthUserPermission[];

const PERMISSION_SET: ReadonlySet<AuthUserPermission> = new Set(
  PERMISSION_VALUES,
);

function isAuthUserPermission(value: string): value is AuthUserPermission {
  return PERMISSION_SET.has(value as AuthUserPermission);
}

/**
 * Defensive projection: drop any value that is not in the
 * AuthUserPermission allowlist. Guards against a stale row in
 * `users.permissions` (text[]) leaking an arbitrary string into the
 * AuthUser shape we hand back over the API.
 */
function sanitizePermissions(
  raw: readonly string[] | null | undefined,
): AuthUserPermission[] {
  if (!raw) return [];
  return raw.filter(isAuthUserPermission);
}

export const SESSION_COOKIE = "sid";
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

/**
 * Server-side session payload. We store a snapshot of the auth user
 * profile so that hot-path route handlers don't have to hit the users
 * table on every request, plus optional Google tokens for features
 * that need them (Calendar, Gmail, Tasks — added in a later task).
 */
export interface SessionData {
  user: AuthUser;
  google?: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    scopes: string[];
  };
}

/**
 * Cookie SameSite policy. Defaults to "lax" (same-origin or top-level
 * navigation, the safer default for a single-domain deployment). When
 * the API and the SPA live on different domains (e.g. two separate
 * Railway services), set `COOKIE_SAMESITE=none` so the browser will
 * include the session cookie on cross-site XHR. SameSite=None requires
 * Secure, which we always set in production anyway.
 */
function cookieSameSite(): "lax" | "none" | "strict" {
  const v = (process.env.COOKIE_SAMESITE ?? "lax").toLowerCase();
  if (v === "none" || v === "strict") return v;
  return "lax";
}

export function setSessionCookie(res: Response, sid: string): void {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: cookieSameSite(),
    path: "/",
    maxAge: SESSION_TTL,
  });
}

export { cookieSameSite };

export async function createSession(data: SessionData): Promise<string> {
  const sid = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    sid,
    sess: data as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + SESSION_TTL),
  });
  return sid;
}

export async function getSession(sid: string): Promise<SessionData | null> {
  const [row] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sid, sid));

  if (!row) return null;
  if (row.expire < new Date()) {
    await deleteSession(sid);
    return null;
  }

  return row.sess as unknown as SessionData;
}

export async function updateSession(
  sid: string,
  data: SessionData,
): Promise<void> {
  await db
    .update(sessionsTable)
    .set({
      sess: data as unknown as Record<string, unknown>,
      expire: new Date(Date.now() + SESSION_TTL),
    })
    .where(eq(sessionsTable.sid, sid));
}

export async function deleteSession(sid: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

export async function clearSession(res: Response, sid?: string): Promise<void> {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function getSessionId(req: Request): string | undefined {
  const authHeader = req.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.cookies?.[SESSION_COOKIE];
}

/**
 * Project a database `users` row into the public `AuthUser` shape that
 * is exposed via the API and stored in the session payload.
 */
export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    preferredName: user.preferredName ?? null,
    profileImageUrl: user.profileImageUrl ?? null,
    linkingId: user.linkingId ?? null,
    payrollId: user.payrollId ?? null,
    companyId: user.companyId ?? null,
    companyName: user.companyName ?? null,
    venueId: user.venueId ?? null,
    venueName: user.venueName ?? null,
    workAreaId: user.workAreaId ?? null,
    workAreaName: user.workAreaName ?? null,
    roleId: user.roleId ?? null,
    roleName: user.roleName ?? null,
    permissions: sanitizePermissions(user.permissions),
  };
}

/**
 * Look up the authoritative user record by id. Returns null if the
 * session references a deleted user.
 */
export async function loadUserById(id: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id));
  return user ?? null;
}
