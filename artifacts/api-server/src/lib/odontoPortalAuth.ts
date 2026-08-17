import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, sql } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db, odontoPortalSessions, odontoPortalUsers } from "@workspace/db";

const scrypt = promisify(scryptCallback);
export const ODONTO_SESSION_COOKIE = "odonto_portal_session";
const SESSION_DAYS = 7;
let bootstrapComplete = false;

export type PortalRole = "admin" | "member";
export type PortalAccountType =
  | "creator"
  | "supervisor"
  | "manager"
  | "member"
  | "individual";
export type PortalAccountStatus = "pending" | "active" | "suspended";
export type PortalPrincipal = {
  id: string;
  username: string;
  displayName: string;
  role: PortalRole;
  accountType: PortalAccountType;
  accountStatus: PortalAccountStatus;
  managerId: string | null;
  workspaceOwnerId: string;
  mustChangePassword: boolean;
  isActive: boolean;
  teamMemberLimit: number;
};
export type PortalRequest = Request & { portalUser?: PortalPrincipal };

function normalizedUsername(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function passwordHash(value: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(value, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function passwordMatches(value: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = (await scrypt(value, salt, 64)) as Buffer;
  const expectedBuffer = Buffer.from(expected, "hex");
  return (
    expectedBuffer.length === actual.length &&
    timingSafeEqual(expectedBuffer, actual)
  );
}

export function publicUser(user: PortalPrincipal) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    accountType: user.accountType,
    accountStatus: user.accountStatus,
    managerId: user.managerId,
    workspaceOwnerId: user.workspaceOwnerId,
    mustChangePassword: user.mustChangePassword,
    isActive: user.isActive,
    teamMemberLimit: user.teamMemberLimit,
  };
}

export async function bootstrapAdmin() {
  if (bootstrapComplete) return;
  await db.execute(
    sql`ALTER TABLE odonto_portal_users ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'individual'`,
  );
  await db.execute(
    sql`ALTER TABLE odonto_portal_users ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active'`,
  );
  await db.execute(
    sql`ALTER TABLE odonto_portal_users ADD COLUMN IF NOT EXISTS manager_id text`,
  );
  await db.execute(
    sql`ALTER TABLE odonto_portal_users ADD COLUMN IF NOT EXISTS workspace_owner_id text`,
  );
  await db.execute(
    sql`ALTER TABLE odonto_portal_users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true`,
  );
  await db.execute(
    sql`ALTER TABLE odonto_portal_users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true`,
  );
  await db.execute(
    sql`ALTER TABLE odonto_portal_users ADD COLUMN IF NOT EXISTS team_member_limit integer NOT NULL DEFAULT 10`,
  );
  await db.execute(
    sql`ALTER TABLE odonto_portal_users ADD COLUMN IF NOT EXISTS last_login_at timestamptz`,
  );
  await db.execute(
    sql`UPDATE odonto_portal_users SET account_type = CASE WHEN role = 'admin' THEN 'creator' ELSE 'individual' END WHERE account_type IS NULL`,
  );
  await db.execute(
    sql`UPDATE odonto_portal_users SET account_status = CASE WHEN is_active = false THEN 'suspended' ELSE 'active' END WHERE account_status IS NULL OR account_status = ''`,
  );
  await db.execute(
    sql`UPDATE odonto_portal_users SET workspace_owner_id = id WHERE workspace_owner_id IS NULL`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS odonto_portal_users_manager_idx ON odonto_portal_users (manager_id)`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS odonto_portal_users_workspace_idx ON odonto_portal_users (workspace_owner_id)`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS odonto_portal_users_status_idx ON odonto_portal_users (account_status)`,
  );
  const username = normalizedUsername(
    process.env.ODONTO_ADMIN_USERNAME ?? "daniel",
  );
  const password = process.env.ODONTO_ADMIN_PASSWORD;
  if (!password) {
    bootstrapComplete = true;
    return;
  }
  const [existing] = await db
    .select({
      id: odontoPortalUsers.id,
      accountType: odontoPortalUsers.accountType,
      accountStatus: odontoPortalUsers.accountStatus,
      passwordHash: odontoPortalUsers.passwordHash,
    })
    .from(odontoPortalUsers)
    .where(eq(odontoPortalUsers.username, username))
    .limit(1);
  if (existing) {
    await db
      .update(odontoPortalUsers)
      .set({
        role: "admin",
        accountType: "creator",
        accountStatus: "active",
        managerId: null,
        workspaceOwnerId: existing.id,
        mustChangePassword: false,
        isActive: true,
        teamMemberLimit: 999,
      })
      .where(eq(odontoPortalUsers.id, existing.id));
    bootstrapComplete = true;
    return;
  }
  const id = crypto.randomUUID();
  await db.insert(odontoPortalUsers).values({
    id,
    username,
    email: `${username}@portal.local`,
    displayName: process.env.ODONTO_ADMIN_DISPLAY_NAME?.trim() || "Daniel",
    passwordHash: await passwordHash(password),
    role: "admin",
    accountType: "creator",
    accountStatus: "active",
    managerId: null,
    workspaceOwnerId: id,
    mustChangePassword: false,
    isActive: true,
    teamMemberLimit: 999,
  });
  bootstrapComplete = true;
}

export async function attachPortalUser(
  req: PortalRequest,
  _res: Response,
  next: NextFunction,
) {
  const rawToken = req.cookies?.[ODONTO_SESSION_COOKIE];
  if (!rawToken || typeof rawToken !== "string") return next();
  try {
    const [session] = await db
      .select({
        id: odontoPortalUsers.id,
        username: odontoPortalUsers.username,
        displayName: odontoPortalUsers.displayName,
        role: odontoPortalUsers.role,
        accountType: odontoPortalUsers.accountType,
        accountStatus: odontoPortalUsers.accountStatus,
        managerId: odontoPortalUsers.managerId,
        workspaceOwnerId: odontoPortalUsers.workspaceOwnerId,
        mustChangePassword: odontoPortalUsers.mustChangePassword,
        isActive: odontoPortalUsers.isActive,
        teamMemberLimit: odontoPortalUsers.teamMemberLimit,
      })
      .from(odontoPortalSessions)
      .innerJoin(
        odontoPortalUsers,
        eq(odontoPortalSessions.userId, odontoPortalUsers.id),
      )
      .where(
        and(
          eq(odontoPortalSessions.tokenHash, tokenHash(rawToken)),
          gt(odontoPortalSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (session?.isActive && session.accountStatus === "active")
      req.portalUser = {
        ...session,
        role: session.role === "admin" ? "admin" : "member",
        accountType: ([
          "creator",
          "supervisor",
          "manager",
          "member",
          "individual",
        ].includes(session.accountType)
          ? session.accountType
          : "individual") as PortalAccountType,
        accountStatus: (["pending", "active", "suspended"].includes(
          session.accountStatus,
        )
          ? session.accountStatus
          : "active") as PortalAccountStatus,
        workspaceOwnerId: session.workspaceOwnerId || session.id,
      };
  } catch {
    // Authentication outages are handled by protected endpoints rather than leaking database detail.
  }
  next();
}

export function requirePortalUser(
  req: PortalRequest,
  res: Response,
): PortalPrincipal | null {
  if (req.portalUser) return req.portalUser;
  res.status(401).json({ error: "Entre para acessar seu ambiente." });
  return null;
}

export function requirePortalAdmin(
  req: PortalRequest,
  res: Response,
): PortalPrincipal | null {
  const user = requirePortalUser(req, res);
  if (!user) return null;
  if (user.accountType === "creator" && user.role === "admin") return user;
  res.status(403).json({ error: "Você não tem permissão para essa área." });
  return null;
}

export function requirePortalManager(
  req: PortalRequest,
  res: Response,
): PortalPrincipal | null {
  const user = requirePortalUser(req, res);
  if (!user) return null;
  if (user.accountType === "creator" || user.accountType === "manager")
    return user;
  res
    .status(403)
    .json({ error: "Você não tem permissão para gerenciar usuários." });
  return null;
}

export async function beginPortalSession(res: Response, user: PortalPrincipal) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(odontoPortalSessions).values({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash: tokenHash(token),
    expiresAt,
  });
  res.cookie(ODONTO_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function endPortalSession(req: PortalRequest, res: Response) {
  const rawToken = req.cookies?.[ODONTO_SESSION_COOKIE];
  if (typeof rawToken === "string") {
    await db
      .delete(odontoPortalSessions)
      .where(eq(odontoPortalSessions.tokenHash, tokenHash(rawToken)));
  }
  res.clearCookie(ODONTO_SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });
}

export function loginRateLimit(maxAttempts = 10, windowMs = 15 * 60_000) {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = Date.now();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (now - lastSweep > windowMs) {
      for (const [mapKey, entry] of attempts) {
        if (entry.resetAt <= now) attempts.delete(mapKey);
      }
      lastSweep = now;
    }
    const key = `${req.ip}:${typeof req.body?.username === "string" ? normalizedUsername(req.body.username) : "unknown"}`;
    const entry = attempts.get(key);
    if (entry && entry.resetAt > now && entry.count >= maxAttempts) {
      res
        .status(429)
        .json({ error: "Muitas tentativas. Aguarde alguns minutos." });
      return;
    }
    attempts.set(
      key,
      entry && entry.resetAt > now
        ? { ...entry, count: entry.count + 1 }
        : { count: 1, resetAt: now + windowMs },
    );
    next();
  };
}
