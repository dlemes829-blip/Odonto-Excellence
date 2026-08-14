import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db, odontoPortalSessions, odontoPortalUsers } from "@workspace/db";

const scrypt = promisify(scryptCallback);
export const ODONTO_SESSION_COOKIE = "odonto_portal_session";
const SESSION_DAYS = 7;

export type PortalRole = "admin" | "member";
export type PortalPrincipal = { id: string; email: string; displayName: string; role: PortalRole };
export type PortalRequest = Request & { portalUser?: PortalPrincipal };

function normalizedEmail(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function passwordHash(value: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(value, salt, 64) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function passwordMatches(value: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = await scrypt(value, salt, 64) as Buffer;
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === actual.length && timingSafeEqual(expectedBuffer, actual);
}

export function publicUser(user: PortalPrincipal) {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
}

export async function bootstrapAdmin() {
  const email = process.env.ODONTO_ADMIN_EMAIL?.trim();
  const password = process.env.ODONTO_ADMIN_PASSWORD;
  if (!email || !password) return;
  const cleanEmail = normalizedEmail(email);
  const [existing] = await db.select({ id: odontoPortalUsers.id }).from(odontoPortalUsers).where(eq(odontoPortalUsers.email, cleanEmail)).limit(1);
  if (existing) return;
  await db.insert(odontoPortalUsers).values({
    id: crypto.randomUUID(),
    email: cleanEmail,
    displayName: "Daniel",
    passwordHash: await passwordHash(password),
    role: "admin",
  });
}

export async function attachPortalUser(req: PortalRequest, _res: Response, next: NextFunction) {
  const rawToken = req.cookies?.[ODONTO_SESSION_COOKIE];
  if (!rawToken || typeof rawToken !== "string") return next();
  try {
    const [session] = await db
      .select({ id: odontoPortalUsers.id, email: odontoPortalUsers.email, displayName: odontoPortalUsers.displayName, role: odontoPortalUsers.role })
      .from(odontoPortalSessions)
      .innerJoin(odontoPortalUsers, eq(odontoPortalSessions.userId, odontoPortalUsers.id))
      .where(and(eq(odontoPortalSessions.tokenHash, tokenHash(rawToken)), gt(odontoPortalSessions.expiresAt, new Date())))
      .limit(1);
    if (session) req.portalUser = { ...session, role: session.role === "admin" ? "admin" : "member" };
  } catch {
    // Authentication outages are handled by the protected endpoint rather than leaking database detail.
  }
  next();
}

export function requirePortalUser(req: PortalRequest, res: Response): PortalPrincipal | null {
  if (req.portalUser) return req.portalUser;
  res.status(401).json({ error: "Entre para acessar seu ambiente." });
  return null;
}

export function requirePortalAdmin(req: PortalRequest, res: Response): PortalPrincipal | null {
  const user = requirePortalUser(req, res);
  if (!user) return null;
  if (user.role === "admin") return user;
  res.status(403).json({ error: "Você não tem permissão para essa área." });
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
    await db.delete(odontoPortalSessions).where(eq(odontoPortalSessions.tokenHash, tokenHash(rawToken)));
  }
  res.clearCookie(ODONTO_SESSION_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", path: "/" });
}

export function loginRateLimit(maxAttempts = 10, windowMs = 15 * 60_000) {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}:${typeof req.body?.email === "string" ? normalizedEmail(req.body.email) : "unknown"}`;
    const now = Date.now();
    const entry = attempts.get(key);
    if (entry && entry.resetAt > now && entry.count >= maxAttempts) {
      res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos." });
      return;
    }
    attempts.set(key, entry && entry.resetAt > now ? { ...entry, count: entry.count + 1 } : { count: 1, resetAt: now + windowMs });
    next();
  };
}
