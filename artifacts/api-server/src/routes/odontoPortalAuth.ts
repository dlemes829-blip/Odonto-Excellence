import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  odontoPortalNotifications,
  odontoPortalPasswordResets,
  odontoPortalSessions,
  odontoPortalUsers,
  odontoPortalUserStates,
} from "@workspace/db";
import {
  attachPortalUser,
  beginPortalSession,
  bootstrapAdmin,
  endPortalSession,
  loginRateLimit,
  passwordHash,
  passwordMatches,
  publicUser,
  requirePortalManager,
  requirePortalUser,
  tokenHash,
  type PortalAccountType,
  type PortalRequest,
} from "../lib/odontoPortalAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const cleanText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const cleanUsername = (value: unknown) =>
  cleanText(value, 32).toLocaleLowerCase("pt-BR");

function workspaceSummary(state: unknown) {
  const source =
    state && typeof state === "object"
      ? (state as Record<string, unknown>)
      : {};
  const collaborators = Array.isArray(source.collaborators)
    ? (source.collaborators as Array<Record<string, unknown>>)
    : [];
  const totals = collaborators.reduce<{ calls: number; messages: number; whatsapp: number; conversions: number; refusals: number; appointments: number }>(
    (result, person) => ({
      calls: result.calls + Math.max(0, Number(person.calls) || 0),
      messages: result.messages + Math.max(0, Number(person.messages) || 0),
      whatsapp: result.whatsapp + Math.max(0, Number(person.whatsapp) || 0),
      conversions:
        result.conversions + Math.max(0, Number(person.conversions) || 0),
      refusals: result.refusals + Math.max(0, Number(person.refusals) || 0),
      appointments:
        result.appointments +
        (Array.isArray(person.appointments) ? person.appointments.length : 0),
    }),
    {
      calls: 0,
      messages: 0,
      whatsapp: 0,
      conversions: 0,
      refusals: 0,
      appointments: 0,
    },
  );
  return { collaborators: collaborators.length, ...totals };
}

async function manageableTarget(
  principal: NonNullable<PortalRequest["portalUser"]>,
  targetId: string,
) {
  const [target] = await db
    .select()
    .from(odontoPortalUsers)
    .where(eq(odontoPortalUsers.id, targetId))
    .limit(1);
  if (!target) return null;
  if (
    principal.accountType === "creator" ||
    target.id === principal.id ||
    target.managerId === principal.id
  )
    return target;
  return null;
}

router.use((req, res, next) => {
  void bootstrapAdmin()
    .then(() => attachPortalUser(req as PortalRequest, res, next))
    .catch(next);
});

router.get("/odonto-portal/auth/me", (req, res) => {
  const user = (req as PortalRequest).portalUser;
  res.setHeader("Cache-Control", "no-store");
  res.json({ user: user ? publicUser(user) : null });
});

router.post("/odonto-portal/auth/register", loginRateLimit(), (_req, res) => {
  res
    .status(403)
    .json({
      error:
        "As contas são criadas pelo administrador ou pelo gerente da equipe.",
    });
});

router.post("/odonto-portal/auth/login", loginRateLimit(), async (req, res) => {
  const username = cleanUsername(req.body?.username);
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
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
    if (!record.isActive) {
      res
        .status(403)
        .json({ error: "Esta conta está suspensa. Fale com seu responsável." });
      return;
    }
    const accountType = (
      ["creator", "manager", "member", "individual"].includes(
        record.accountType,
      )
        ? record.accountType
        : "individual"
    ) as PortalAccountType;
    const user = {
      id: record.id,
      username: record.username,
      displayName: record.displayName,
      role: record.role === "admin" ? ("admin" as const) : ("member" as const),
      accountType,
      managerId: record.managerId,
      workspaceOwnerId: record.workspaceOwnerId || record.id,
      mustChangePassword: record.mustChangePassword,
      isActive: record.isActive,
      teamMemberLimit: record.teamMemberLimit,
    };
    await db
      .update(odontoPortalUsers)
      .set({ lastSeenAt: new Date(), lastLoginAt: new Date() })
      .where(eq(odontoPortalUsers.id, user.id));
    await beginPortalSession(res, user);
    res.json({ user: publicUser(user) });
  } catch (error) {
    logger.error({ err: error }, "Unable to log in Odonto portal user");
    res.status(503).json({ error: "O acesso está indisponível no momento." });
  }
});

router.put(
  "/odonto-portal/auth/password",
  loginRateLimit(5),
  async (req, res) => {
    const user = requirePortalUser(req as PortalRequest, res);
    if (!user) return;
    const currentPassword =
      typeof req.body?.currentPassword === "string"
        ? req.body.currentPassword
        : "";
    const newPassword =
      typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
    if (
      newPassword.length < 8 ||
      !/[A-Za-z]/.test(newPassword) ||
      !/\d/.test(newPassword)
    ) {
      res
        .status(400)
        .json({ error: "Use pelo menos 8 caracteres, com letra e número." });
      return;
    }
    const [record] = await db
      .select({ passwordHash: odontoPortalUsers.passwordHash })
      .from(odontoPortalUsers)
      .where(eq(odontoPortalUsers.id, user.id))
      .limit(1);
    if (
      !record ||
      !(await passwordMatches(currentPassword, record.passwordHash))
    ) {
      res.status(401).json({ error: "A senha atual está incorreta." });
      return;
    }
    await db
      .update(odontoPortalUsers)
      .set({
        passwordHash: await passwordHash(newPassword),
        mustChangePassword: false,
      })
      .where(eq(odontoPortalUsers.id, user.id));
    await db
      .delete(odontoPortalSessions)
      .where(eq(odontoPortalSessions.userId, user.id));
    const refreshed = { ...user, mustChangePassword: false };
    await beginPortalSession(res, refreshed);
    res.json({ user: publicUser(refreshed) });
  },
);

router.post(
  "/odonto-portal/auth/password-reset/request",
  loginRateLimit(5),
  (_req, res) => {
    res
      .status(410)
      .json({
        error: "A redefinição de senha é feita pelo administrador do portal.",
      });
  },
);

router.post(
  "/odonto-portal/auth/password-reset/confirm",
  loginRateLimit(),
  async (req, res) => {
    const token = cleanText(req.body?.token, 200);
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";
    if (!token || password.length < 8) {
      res
        .status(400)
        .json({ error: "Use uma nova senha com pelo menos 8 caracteres." });
      return;
    }
    try {
      const [reset] = await db
        .select()
        .from(odontoPortalPasswordResets)
        .where(
          and(
            eq(odontoPortalPasswordResets.tokenHash, tokenHash(token)),
            gt(odontoPortalPasswordResets.expiresAt, new Date()),
            isNull(odontoPortalPasswordResets.usedAt),
          ),
        )
        .limit(1);
      if (!reset) {
        res
          .status(400)
          .json({ error: "Este link expirou ou já foi utilizado." });
        return;
      }
      await db
        .update(odontoPortalUsers)
        .set({ passwordHash: await passwordHash(password) })
        .where(eq(odontoPortalUsers.id, reset.userId));
      await db
        .update(odontoPortalPasswordResets)
        .set({ usedAt: new Date() })
        .where(eq(odontoPortalPasswordResets.id, reset.id));
      await db
        .delete(odontoPortalSessions)
        .where(eq(odontoPortalSessions.userId, reset.userId));
      res.status(204).end();
    } catch (error) {
      logger.error({ err: error }, "Unable to reset Odonto portal password");
      res
        .status(503)
        .json({ error: "Não foi possível atualizar a senha agora." });
    }
  },
);

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
  await db
    .update(odontoPortalUsers)
    .set({ lastSeenAt: new Date() })
    .where(eq(odontoPortalUsers.id, user.id));
  res.status(204).end();
});

router.get("/odonto-portal/notifications", async (req, res) => {
  const user = requirePortalUser(req as PortalRequest, res);
  if (!user) return;
  const records = await db
    .select()
    .from(odontoPortalNotifications)
    .where(
      or(
        eq(odontoPortalNotifications.userId, user.id),
        isNull(odontoPortalNotifications.userId),
      ),
    )
    .orderBy(desc(odontoPortalNotifications.createdAt))
    .limit(25);
  res.json({ notifications: records });
});

router.patch("/odonto-portal/notifications/:id/read", async (req, res) => {
  const user = requirePortalUser(req as PortalRequest, res);
  if (!user) return;
  await db
    .update(odontoPortalNotifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(odontoPortalNotifications.id, req.params.id),
        eq(odontoPortalNotifications.userId, user.id),
      ),
    );
  res.status(204).end();
});

router.get("/odonto-portal/admin/users", async (req, res) => {
  const principal = requirePortalManager(req as PortalRequest, res);
  if (!principal) return;
  const base = db
    .select({
      id: odontoPortalUsers.id,
      username: odontoPortalUsers.username,
      displayName: odontoPortalUsers.displayName,
      role: odontoPortalUsers.role,
      accountType: odontoPortalUsers.accountType,
      managerId: odontoPortalUsers.managerId,
      workspaceOwnerId: odontoPortalUsers.workspaceOwnerId,
      mustChangePassword: odontoPortalUsers.mustChangePassword,
      isActive: odontoPortalUsers.isActive,
      teamMemberLimit: odontoPortalUsers.teamMemberLimit,
      createdAt: odontoPortalUsers.createdAt,
      lastSeenAt: odontoPortalUsers.lastSeenAt,
      lastLoginAt: odontoPortalUsers.lastLoginAt,
    })
    .from(odontoPortalUsers);
  const users =
    principal.accountType === "creator"
      ? await base.orderBy(desc(odontoPortalUsers.lastSeenAt))
      : await base
          .where(
            or(
              eq(odontoPortalUsers.id, principal.id),
              eq(odontoPortalUsers.managerId, principal.id),
            ),
          )
          .orderBy(desc(odontoPortalUsers.lastSeenAt));
  const workspaceIds = [
    ...new Set(users.map((user) => user.workspaceOwnerId || user.id)),
  ];
  const states = workspaceIds.length
    ? await db
        .select()
        .from(odontoPortalUserStates)
        .where(inArray(odontoPortalUserStates.userId, workspaceIds))
    : [];
  const summaries = new Map(
    states.map((state) => [state.userId, workspaceSummary(state.state)]),
  );
  res.json({
    users: users.map((user) => ({
      ...user,
      workspaceOwnerId: user.workspaceOwnerId || user.id,
      online: user.lastSeenAt.getTime() > Date.now() - 90_000,
      summary:
        summaries.get(user.workspaceOwnerId || user.id) ||
        workspaceSummary(null),
    })),
  });
});

router.post("/odonto-portal/admin/users", async (req, res) => {
  const principal = requirePortalManager(req as PortalRequest, res);
  if (!principal) return;
  const username = cleanUsername(req.body?.username);
  const displayName = cleanText(req.body?.displayName, 80);
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  const requestedType = cleanText(
    req.body?.accountType,
    20,
  ) as PortalAccountType;
  const allowedTypes: PortalAccountType[] =
    principal.accountType === "creator"
      ? ["manager", "individual"]
      : ["member"];
  if (
    !usernamePattern.test(username) ||
    !displayName ||
    password.length < 8 ||
    !allowedTypes.includes(requestedType)
  ) {
    res
      .status(400)
      .json({ error: "Confira nome, usuário, senha e tipo de conta." });
    return;
  }
  try {
    if (principal.accountType === "manager") {
      const members = await db
        .select({ id: odontoPortalUsers.id })
        .from(odontoPortalUsers)
        .where(eq(odontoPortalUsers.managerId, principal.id));
      if (members.length >= principal.teamMemberLimit) {
        res
          .status(409)
          .json({
            error: `Limite de ${principal.teamMemberLimit} usuários da equipe atingido.`,
          });
        return;
      }
    }
    const [existing] = await db
      .select({ id: odontoPortalUsers.id })
      .from(odontoPortalUsers)
      .where(eq(odontoPortalUsers.username, username))
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "Este nome de usuário já está em uso." });
      return;
    }
    const id = crypto.randomUUID();
    const managerId = requestedType === "member" ? principal.id : null;
    const workspaceOwnerId =
      requestedType === "member" ? principal.workspaceOwnerId : id;
    const [created] = await db
      .insert(odontoPortalUsers)
      .values({
        id,
        username,
        email: `${username}@portal.local`,
        displayName,
        passwordHash: await passwordHash(password),
        role: "member",
        accountType: requestedType,
        managerId,
        workspaceOwnerId,
        mustChangePassword: true,
        isActive: true,
        teamMemberLimit: requestedType === "manager" ? 10 : 0,
      })
      .returning({
        id: odontoPortalUsers.id,
        username: odontoPortalUsers.username,
        displayName: odontoPortalUsers.displayName,
        role: odontoPortalUsers.role,
        accountType: odontoPortalUsers.accountType,
        managerId: odontoPortalUsers.managerId,
        workspaceOwnerId: odontoPortalUsers.workspaceOwnerId,
        mustChangePassword: odontoPortalUsers.mustChangePassword,
        isActive: odontoPortalUsers.isActive,
        teamMemberLimit: odontoPortalUsers.teamMemberLimit,
      });
    res.status(201).json({ user: created });
  } catch (error) {
    logger.error({ err: error }, "Unable to create managed Odonto account");
    res.status(503).json({ error: "Não foi possível criar a conta agora." });
  }
});

router.put("/odonto-portal/admin/users/:id/password", async (req, res) => {
  const principal = requirePortalManager(req as PortalRequest, res);
  if (!principal) return;
  const [target] = await db
    .select({
      id: odontoPortalUsers.id,
      managerId: odontoPortalUsers.managerId,
      accountType: odontoPortalUsers.accountType,
    })
    .from(odontoPortalUsers)
    .where(eq(odontoPortalUsers.id, req.params.id))
    .limit(1);
  if (
    !target ||
    (principal.accountType !== "creator" && target.managerId !== principal.id)
  ) {
    res.status(404).json({ error: "Conta não encontrada." });
    return;
  }
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  if (password.length < 8) {
    res
      .status(400)
      .json({ error: "A nova senha precisa ter pelo menos 8 caracteres." });
    return;
  }
  const updated = await db
    .update(odontoPortalUsers)
    .set({
      passwordHash: await passwordHash(password),
      mustChangePassword: true,
    })
    .where(eq(odontoPortalUsers.id, req.params.id))
    .returning({ id: odontoPortalUsers.id });
  if (!updated.length) {
    res.status(404).json({ error: "Conta não encontrada." });
    return;
  }
  await db
    .delete(odontoPortalSessions)
    .where(eq(odontoPortalSessions.userId, req.params.id));
  res.status(204).end();
});

router.patch("/odonto-portal/admin/users/:id", async (req, res) => {
  const principal = requirePortalManager(req as PortalRequest, res);
  if (!principal) return;
  const target = await manageableTarget(principal, req.params.id);
  if (!target) {
    res.status(404).json({ error: "Conta não encontrada." });
    return;
  }
  const requestedDisplayName = cleanText(req.body?.displayName, 80);
  const displayName = requestedDisplayName || target.displayName;
  const isActive =
    typeof req.body?.isActive === "boolean"
      ? req.body.isActive
      : target.isActive;
  const teamMemberLimit =
    principal.accountType === "creator" && target.accountType === "manager"
      ? Math.max(
          1,
          Math.min(
            250,
            Math.round(
              Number(req.body?.teamMemberLimit) || target.teamMemberLimit,
            ),
          ),
        )
      : target.teamMemberLimit;
  if (!displayName) {
    res.status(400).json({ error: "Informe o nome do usuário." });
    return;
  }
  if (target.id === principal.id && !isActive) {
    res.status(400).json({ error: "Você não pode suspender a própria conta." });
    return;
  }
  const [updated] = await db
    .update(odontoPortalUsers)
    .set({ displayName, isActive, teamMemberLimit })
    .where(eq(odontoPortalUsers.id, target.id))
    .returning({
      id: odontoPortalUsers.id,
      displayName: odontoPortalUsers.displayName,
      isActive: odontoPortalUsers.isActive,
      teamMemberLimit: odontoPortalUsers.teamMemberLimit,
    });
  if (!isActive)
    await db
      .delete(odontoPortalSessions)
      .where(eq(odontoPortalSessions.userId, target.id));
  res.json({ user: updated });
});

router.post("/odonto-portal/admin/notifications", async (req, res) => {
  const principal = requirePortalManager(req as PortalRequest, res);
  if (!principal) return;
  const title = cleanText(req.body?.title, 100);
  const body = cleanText(req.body?.body, 500);
  const requestedUserId = cleanText(req.body?.userId, 100);
  if (!title || !body) {
    res.status(400).json({ error: "Informe título e mensagem." });
    return;
  }
  let recipients: Array<{ id: string }>;
  if (requestedUserId) {
    const target = await manageableTarget(principal, requestedUserId);
    if (!target) {
      res.status(404).json({ error: "Destinatário não encontrado." });
      return;
    }
    recipients = [{ id: target.id }];
  } else if (principal.accountType === "creator") {
    recipients = await db
      .select({ id: odontoPortalUsers.id })
      .from(odontoPortalUsers)
      .where(eq(odontoPortalUsers.isActive, true));
  } else {
    recipients = await db
      .select({ id: odontoPortalUsers.id })
      .from(odontoPortalUsers)
      .where(
        and(
          eq(odontoPortalUsers.workspaceOwnerId, principal.workspaceOwnerId),
          eq(odontoPortalUsers.isActive, true),
        ),
      );
  }
  if (!recipients.length) {
    res
      .status(409)
      .json({ error: "Nenhum destinatário ativo foi encontrado." });
    return;
  }
  const notices = await db
    .insert(odontoPortalNotifications)
    .values(
      recipients.map((recipient) => ({
        id: crypto.randomUUID(),
        userId: recipient.id,
        title,
        body,
        kind: "admin",
      })),
    )
    .returning();
  res.status(201).json({ notifications: notices, delivered: notices.length });
});

export default router;
