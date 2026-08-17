import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, odontoPortalSessions, odontoPortalUsers } from "@workspace/db";
import {
  ODONTO_SESSION_COOKIE,
  loginRateLimit,
  passwordMatches,
  publicUser,
  tokenHash,
  type PortalAccountStatus,
  type PortalAccountType,
  type PortalPrincipal,
} from "../lib/odontoPortalAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const SESSION_DAYS = 7;

function cleanUsername(value: unknown) {
  return typeof value === "string"
    ? value.trim().slice(0, 32).toLocaleLowerCase("pt-BR")
    : "";
}

/**
 * Safari/iOS may refuse to persist the API cookie because the static portal
 * and the API are different origins. Accept the same opaque server session
 * token as a Bearer fallback. The token still has to exist (hashed) in the
 * sessions table and is subject to the exact same expiry/account checks.
 */
router.use((req, _res, next) => {
  const authorization = req.get("authorization");
  if (
    authorization?.startsWith("Bearer ") &&
    !req.cookies?.[ODONTO_SESSION_COOKIE]
  ) {
    const token = authorization.slice(7).trim();
    if (token) {
      req.cookies ??= {};
      req.cookies[ODONTO_SESSION_COOKIE] = token;
    }
  }
  next();
});

router.post(
  "/odonto-portal/auth/login-stable",
  loginRateLimit(),
  async (req, res) => {
    const username = cleanUsername(req.body?.username);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    try {
      const [record] = await db
        .select()
        .from(odontoPortalUsers)
        .where(eq(odontoPortalUsers.username, username))
        .limit(1);

      if (!record || !(await passwordMatches(password, record.passwordHash))) {
        res.status(401).json({ error: "Nome de usuário ou senha incorretos." });
        return;
      }
      if (record.accountStatus === "pending") {
        res.status(403).json({ error: "Seu pedido ainda está aguardando aprovação do administrador." });
        return;
      }
      if (!record.isActive || record.accountStatus === "suspended") {
        res.status(403).json({ error: "Esta conta está suspensa. Fale com seu responsável." });
        return;
      }

      const allowedTypes = ["creator", "supervisor", "manager", "member", "individual"];
      const accountType = (allowedTypes.includes(record.accountType)
        ? record.accountType
        : "individual") as PortalAccountType;
      const accountStatus = (["pending", "active", "suspended"].includes(record.accountStatus)
        ? record.accountStatus
        : "active") as PortalAccountStatus;
      const user: PortalPrincipal = {
        id: record.id,
        username: record.username,
        displayName: record.displayName,
        role: record.role === "admin" ? "admin" : "member",
        accountType,
        accountStatus,
        managerId: record.managerId,
        workspaceOwnerId: record.workspaceOwnerId || record.id,
        mustChangePassword: record.mustChangePassword,
        isActive: record.isActive,
        teamMemberLimit: record.teamMemberLimit,
      };

      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
      await db.insert(odontoPortalSessions).values({
        id: crypto.randomUUID(),
        userId: user.id,
        tokenHash: tokenHash(token),
        expiresAt,
      });
      await db
        .update(odontoPortalUsers)
        .set({ lastSeenAt: new Date(), lastLoginAt: new Date() })
        .where(eq(odontoPortalUsers.id, user.id));

      res.cookie(ODONTO_SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        expires: expiresAt,
        path: "/",
      });
      res.setHeader("Cache-Control", "no-store");
      res.json({ user: publicUser(user), sessionToken: token, expiresAt: expiresAt.toISOString() });
    } catch (error) {
      logger.error({ err: error }, "Unable to create resilient Odonto portal session");
      res.status(503).json({ error: "O acesso está indisponível no momento." });
    }
  },
);

export default router;
