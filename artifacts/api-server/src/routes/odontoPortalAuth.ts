import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, odontoPortalNotifications, odontoPortalPasswordResets, odontoPortalSessions, odontoPortalUsers } from "@workspace/db";
import { attachPortalUser, beginPortalSession, bootstrapAdmin, endPortalSession, loginRateLimit, passwordHash, passwordMatches, publicUser, requirePortalAdmin, requirePortalUser, tokenHash, type PortalRequest } from "../lib/odontoPortalAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeEmail = (value: string) => value.trim().toLocaleLowerCase("pt-BR");
const cleanText = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

router.use((req, res, next) => { void bootstrapAdmin().then(() => attachPortalUser(req as PortalRequest, res, next)).catch(next); });

router.get("/odonto-portal/auth/me", (req, res) => {
  const user = (req as PortalRequest).portalUser;
  res.setHeader("Cache-Control", "no-store");
  res.json({ user: user ? publicUser(user) : null });
});

router.post("/odonto-portal/auth/register", loginRateLimit(), async (req, res) => {
  const email = cleanText(req.body?.email, 254).toLocaleLowerCase("pt-BR");
  const displayName = cleanText(req.body?.displayName, 80);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!emailPattern.test(email) || !displayName || password.length < 8) {
    res.status(400).json({ error: "Informe nome, e-mail válido e uma senha com pelo menos 8 caracteres." });
    return;
  }
  try {
    const [existing] = await db.select({ id: odontoPortalUsers.id }).from(odontoPortalUsers).where(eq(odontoPortalUsers.email, email)).limit(1);
    if (existing) {
      res.status(409).json({ error: "Já existe uma conta com este e-mail." });
      return;
    }
    const user = { id: crypto.randomUUID(), email, displayName, role: "member" as const };
    await db.insert(odontoPortalUsers).values({ ...user, passwordHash: await passwordHash(password) });
    await beginPortalSession(res, user);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    logger.error({ err: error }, "Unable to register Odonto portal user");
    res.status(503).json({ error: "Não foi possível criar a conta agora." });
  }
});

router.post("/odonto-portal/auth/login", loginRateLimit(), async (req, res) => {
  const email = cleanText(req.body?.email, 254).toLocaleLowerCase("pt-BR");
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  try {
    const [record] = await db.select().from(odontoPortalUsers).where(eq(odontoPortalUsers.email, email)).limit(1);
    if (!record || !(await passwordMatches(password, record.passwordHash))) {
      res.status(401).json({ error: "E-mail ou senha incorretos." });
      return;
    }
    const user = { id: record.id, email: record.email, displayName: record.displayName, role: record.role === "admin" ? "admin" as const : "member" as const };
    await db.update(odontoPortalUsers).set({ lastSeenAt: new Date() }).where(eq(odontoPortalUsers.id, user.id));
    await beginPortalSession(res, user);
    res.json({ user: publicUser(user) });
  } catch (error) {
    logger.error({ err: error }, "Unable to log in Odonto portal user");
    res.status(503).json({ error: "O acesso está indisponível no momento." });
  }
});

async function sendResetEmail(email: string, resetToken: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const publicUrl = process.env.PORTAL_PUBLIC_URL;
  if (!apiKey || !from || !publicUrl) return false;
  const resetUrl = `${publicUrl.replace(/\/$/, "")}/acesso?reset=${encodeURIComponent(resetToken)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Redefina sua senha - Odonto Excellence",
      html: `<main style="font-family:Arial,sans-serif;color:#221414;max-width:560px;margin:auto;padding:32px"><p style="letter-spacing:.12em;color:#a91616;font-weight:700;font-size:12px">ODONTO EXCELLENCE</p><h1 style="font-size:28px">Redefina sua senha</h1><p>Recebemos uma solicitação para acessar seu ambiente privado. O link abaixo expira em 30 minutos.</p><p style="margin:28px 0"><a href="${resetUrl}" style="background:#a91616;color:#fff;padding:13px 20px;border-radius:8px;text-decoration:none;font-weight:700">Redefinir senha</a></p><p style="font-size:12px;color:#765f5f">Se você não solicitou esta alteração, pode ignorar este e-mail.</p></main>`,
    }),
  });
  return response.ok;
}

router.post("/odonto-portal/auth/password-reset/request", loginRateLimit(5), async (req, res) => {
  const email = cleanText(req.body?.email, 254).toLocaleLowerCase("pt-BR");
  const generic = { message: "Se houver uma conta com este e-mail, enviaremos as instruções." };
  if (!emailPattern.test(email)) { res.json(generic); return; }
  try {
    const [user] = await db.select({ id: odontoPortalUsers.id, email: odontoPortalUsers.email }).from(odontoPortalUsers).where(eq(odontoPortalUsers.email, email)).limit(1);
    if (!user) { res.json(generic); return; }
    const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    await db.insert(odontoPortalPasswordResets).values({ id: crypto.randomUUID(), userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 30 * 60_000) });
    const delivered = await sendResetEmail(user.email, token);
    if (!delivered) logger.warn("Password reset email provider is not configured");
    res.json(generic);
  } catch (error) {
    logger.error({ err: error }, "Unable to request Odonto password reset");
    res.status(503).json({ error: "Não foi possível iniciar a recuperação agora." });
  }
});

router.post("/odonto-portal/auth/password-reset/confirm", loginRateLimit(), async (req, res) => {
  const token = cleanText(req.body?.token, 200);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!token || password.length < 8) { res.status(400).json({ error: "Use uma nova senha com pelo menos 8 caracteres." }); return; }
  try {
    const [reset] = await db.select().from(odontoPortalPasswordResets).where(and(eq(odontoPortalPasswordResets.tokenHash, tokenHash(token)), gt(odontoPortalPasswordResets.expiresAt, new Date()), isNull(odontoPortalPasswordResets.usedAt))).limit(1);
    if (!reset) { res.status(400).json({ error: "Este link expirou ou já foi utilizado." }); return; }
    await db.update(odontoPortalUsers).set({ passwordHash: await passwordHash(password) }).where(eq(odontoPortalUsers.id, reset.userId));
    await db.update(odontoPortalPasswordResets).set({ usedAt: new Date() }).where(eq(odontoPortalPasswordResets.id, reset.id));
    await db.delete(odontoPortalSessions).where(eq(odontoPortalSessions.userId, reset.userId));
    res.status(204).end();
  } catch (error) {
    logger.error({ err: error }, "Unable to reset Odonto portal password");
    res.status(503).json({ error: "Não foi possível atualizar a senha agora." });
  }
});

router.post("/odonto-portal/auth/logout", async (req, res) => {
  try {
    await endPortalSession(req as PortalRequest, res);
    res.status(204).end();
  } catch (error) {
    logger.error({ err: error }, "Unable to end Odonto portal session");
    res.status(503).json({ error: "Não foi possível encerrar a sessão." });
  }
});

router.post("/odonto-portal/auth/heartbeat", async (req, res) => {
  const user = requirePortalUser(req as PortalRequest, res);
  if (!user) return;
  await db.update(odontoPortalUsers).set({ lastSeenAt: new Date() }).where(eq(odontoPortalUsers.id, user.id));
  res.status(204).end();
});

router.get("/odonto-portal/notifications", async (req, res) => {
  const user = requirePortalUser(req as PortalRequest, res);
  if (!user) return;
  const records = await db.select().from(odontoPortalNotifications).where(or(eq(odontoPortalNotifications.userId, user.id), isNull(odontoPortalNotifications.userId))).orderBy(desc(odontoPortalNotifications.createdAt)).limit(25);
  res.json({ notifications: records });
});

router.patch("/odonto-portal/notifications/:id/read", async (req, res) => {
  const user = requirePortalUser(req as PortalRequest, res);
  if (!user) return;
  await db.update(odontoPortalNotifications).set({ readAt: new Date() }).where(eq(odontoPortalNotifications.id, req.params.id));
  res.status(204).end();
});

router.get("/odonto-portal/admin/users", async (req, res) => {
  if (!requirePortalAdmin(req as PortalRequest, res)) return;
  const users = await db.select({ id: odontoPortalUsers.id, email: odontoPortalUsers.email, displayName: odontoPortalUsers.displayName, role: odontoPortalUsers.role, createdAt: odontoPortalUsers.createdAt, lastSeenAt: odontoPortalUsers.lastSeenAt }).from(odontoPortalUsers).orderBy(desc(odontoPortalUsers.lastSeenAt));
  res.json({ users: users.map((user) => ({ ...user, online: user.lastSeenAt.getTime() > Date.now() - 90_000 })) });
});

router.put("/odonto-portal/admin/users/:id/password", async (req, res) => {
  if (!requirePortalAdmin(req as PortalRequest, res)) return;
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (password.length < 8) { res.status(400).json({ error: "A nova senha precisa ter pelo menos 8 caracteres." }); return; }
  const updated = await db.update(odontoPortalUsers).set({ passwordHash: await passwordHash(password) }).where(eq(odontoPortalUsers.id, req.params.id)).returning({ id: odontoPortalUsers.id });
  if (!updated.length) { res.status(404).json({ error: "Conta não encontrada." }); return; }
  await db.delete(odontoPortalSessions).where(eq(odontoPortalSessions.userId, req.params.id));
  res.status(204).end();
});

router.post("/odonto-portal/admin/notifications", async (req, res) => {
  if (!requirePortalAdmin(req as PortalRequest, res)) return;
  const title = cleanText(req.body?.title, 100);
  const body = cleanText(req.body?.body, 500);
  const userId = cleanText(req.body?.userId, 100) || null;
  if (!title || !body) { res.status(400).json({ error: "Informe título e mensagem." }); return; }
  const [notice] = await db.insert(odontoPortalNotifications).values({ id: crypto.randomUUID(), userId, title, body, kind: "info" }).returning();
  res.status(201).json({ notification: notice });
});

export default router;
