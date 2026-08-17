import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Router, type IRouter, type Response } from "express";
import {
  db,
  odontoPortalAuditLog,
  odontoPortalPeople,
  odontoPortalSessions,
  odontoPortalSupervisorManagers,
  odontoPortalUsers,
} from "@workspace/db";
import {
  attachPortalUser,
  beginPortalSession,
  bootstrapAdmin,
  loginRateLimit,
  passwordHash,
  passwordMatches,
  publicUser,
  requirePortalUser,
  type PortalRequest,
} from "../lib/odontoPortalAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,31}$/;
let hierarchySchemaReady = false;

type Principal = NonNullable<PortalRequest["portalUser"]>;
type HierarchyType = "creator" | "supervisor" | "manager" | "member" | "individual";

const cleanText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const cleanUsername = (value: unknown) =>
  cleanText(value, 32).toLocaleLowerCase("pt-BR");
const hierarchyType = (principal: Principal): HierarchyType =>
  String(principal.accountType) as HierarchyType;

async function ensureHierarchySchema() {
  if (hierarchySchemaReady) return;

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS odonto_portal_people (
      id text PRIMARY KEY,
      display_name text NOT NULL,
      email text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`ALTER TABLE odonto_portal_users ADD COLUMN IF NOT EXISTS person_id text`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS odonto_portal_users_person_idx ON odonto_portal_users (person_id)`);
  await db.execute(sql`
    INSERT INTO odonto_portal_people (id, display_name, email)
    SELECT id, display_name, email
    FROM odonto_portal_users
    WHERE person_id IS NULL
    ON CONFLICT (id) DO NOTHING
  `);
  await db.execute(sql`UPDATE odonto_portal_users SET person_id = id WHERE person_id IS NULL`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS odonto_portal_supervisor_managers (
      supervisor_id text NOT NULL REFERENCES odonto_portal_users(id) ON DELETE CASCADE,
      manager_id text NOT NULL REFERENCES odonto_portal_users(id) ON DELETE CASCADE,
      created_by text REFERENCES odonto_portal_users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS odonto_portal_supervisor_manager_unique_idx
    ON odonto_portal_supervisor_managers (manager_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS odonto_portal_supervisor_idx
    ON odonto_portal_supervisor_managers (supervisor_id)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS odonto_portal_audit_log (
      id text PRIMARY KEY,
      actor_user_id text REFERENCES odonto_portal_users(id) ON DELETE SET NULL,
      target_user_id text REFERENCES odonto_portal_users(id) ON DELETE SET NULL,
      action text NOT NULL,
      context jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS odonto_portal_audit_actor_idx ON odonto_portal_audit_log (actor_user_id, created_at DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS odonto_portal_audit_target_idx ON odonto_portal_audit_log (target_user_id, created_at DESC)`);

  await db.execute(sql`
    CREATE OR REPLACE FUNCTION odonto_sync_person_display_name()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.person_id IS NOT NULL AND pg_trigger_depth() = 1 THEN
        UPDATE odonto_portal_people
        SET display_name = NEW.display_name, updated_at = now()
        WHERE id = NEW.person_id;
        UPDATE odonto_portal_users
        SET display_name = NEW.display_name
        WHERE person_id = NEW.person_id
          AND id <> NEW.id
          AND display_name IS DISTINCT FROM NEW.display_name;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);
  await db.execute(sql`DROP TRIGGER IF EXISTS odonto_sync_person_display_name_trigger ON odonto_portal_users`);
  await db.execute(sql`
    CREATE TRIGGER odonto_sync_person_display_name_trigger
    AFTER UPDATE OF display_name ON odonto_portal_users
    FOR EACH ROW EXECUTE FUNCTION odonto_sync_person_display_name()
  `);

  hierarchySchemaReady = true;
}

async function audit(
  actorUserId: string,
  action: string,
  targetUserId: string | null = null,
  context: Record<string, unknown> = {},
) {
  await db.insert(odontoPortalAuditLog).values({
    id: crypto.randomUUID(),
    actorUserId,
    targetUserId,
    action,
    context,
  });
}

function requireCreator(req: PortalRequest, res: Response) {
  const principal = requirePortalUser(req, res);
  if (!principal) return null;
  if (hierarchyType(principal) === "creator") return principal;
  res.status(403).json({ error: "Esta área é exclusiva do administrador do sistema." });
  return null;
}

function requireOperational(req: PortalRequest, res: Response) {
  const principal = requirePortalUser(req, res);
  if (!principal) return null;
  if (["creator", "supervisor", "manager"].includes(hierarchyType(principal))) return principal;
  res.status(403).json({ error: "Você não tem permissão para administrar equipes." });
  return null;
}

async function supervisorManagerIds(supervisorId: string) {
  const rows = await db
    .select({ managerId: odontoPortalSupervisorManagers.managerId })
    .from(odontoPortalSupervisorManagers)
    .where(eq(odontoPortalSupervisorManagers.supervisorId, supervisorId));
  return rows.map((row) => row.managerId);
}

async function manageableTarget(principal: Principal, targetId: string) {
  const [target] = await db.select().from(odontoPortalUsers).where(eq(odontoPortalUsers.id, targetId)).limit(1);
  if (!target) return null;
  const type = hierarchyType(principal);
  if (type === "creator") return target;
  if (type === "manager") return target.managerId === principal.id ? target : null;
  if (type === "supervisor") {
    const managerIds = await supervisorManagerIds(principal.id);
    if (target.accountType === "manager" && managerIds.includes(target.id)) return target;
    if (target.managerId && managerIds.includes(target.managerId)) return target;
  }
  return null;
}

async function invalidateSessions(userId: string) {
  await db.delete(odontoPortalSessions).where(eq(odontoPortalSessions.userId, userId));
}

router.use((req, res, next) => {
  void (async () => {
    await bootstrapAdmin();
    await ensureHierarchySchema();
    await attachPortalUser(req as PortalRequest, res, async () => {
      const portalReq = req as PortalRequest;
      if (portalReq.portalUser) {
        const [fresh] = await db
          .select({ accountType: odontoPortalUsers.accountType, accountStatus: odontoPortalUsers.accountStatus, isActive: odontoPortalUsers.isActive })
          .from(odontoPortalUsers)
          .where(eq(odontoPortalUsers.id, portalReq.portalUser.id))
          .limit(1);
        if (!fresh || !fresh.isActive || fresh.accountStatus !== "active") {
          delete portalReq.portalUser;
        } else if (fresh.accountType === "supervisor") {
          (portalReq.portalUser as unknown as { accountType: string }).accountType = "supervisor";
        }
      }
      next();
    });
  })().catch(next);
});

router.post("/odonto-portal/auth/login", loginRateLimit(), async (req, res, next) => {
  const username = cleanUsername(req.body?.username);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  try {
    const [record] = await db.select().from(odontoPortalUsers).where(eq(odontoPortalUsers.username, username)).limit(1);
    if (!record || record.accountType !== "supervisor") return next();
    if (!(await passwordMatches(password, record.passwordHash))) {
      res.status(401).json({ error: "Nome de usuário ou senha incorretos." });
      return;
    }
    if (!record.isActive || record.accountStatus !== "active") {
      res.status(403).json({ error: "Esta conta não está ativa." });
      return;
    }
    const user = {
      id: record.id,
      username: record.username,
      displayName: record.displayName,
      role: "member",
      accountType: "supervisor",
      accountStatus: "active",
      managerId: record.managerId,
      workspaceOwnerId: record.workspaceOwnerId || record.id,
      mustChangePassword: record.mustChangePassword,
      isActive: true,
      teamMemberLimit: record.teamMemberLimit,
    } as unknown as Principal;
    await db.update(odontoPortalUsers).set({ lastSeenAt: new Date(), lastLoginAt: new Date() }).where(eq(odontoPortalUsers.id, record.id));
    await beginPortalSession(res, user);
    res.json({ user: publicUser(user) });
  } catch (error) {
    logger.error({ err: error }, "Unable to log in supervisor");
    res.status(503).json({ error: "O acesso está indisponível no momento." });
  }
});

router.use("/odonto-portal/admin", (req, res, next) => {
  if (!requireCreator(req as PortalRequest, res)) return;
  next();
});

router.get("/odonto-portal/hierarchy/me", async (req, res) => {
  const principal = requirePortalUser(req as PortalRequest, res);
  if (!principal) return;
  const [record] = await db.select({ personId: odontoPortalUsers.personId, accountType: odontoPortalUsers.accountType }).from(odontoPortalUsers).where(eq(odontoPortalUsers.id, principal.id)).limit(1);
  const linkedProfiles = record?.personId
    ? await db
        .select({ id: odontoPortalUsers.id, username: odontoPortalUsers.username, displayName: odontoPortalUsers.displayName, accountType: odontoPortalUsers.accountType, accountStatus: odontoPortalUsers.accountStatus })
        .from(odontoPortalUsers)
        .where(eq(odontoPortalUsers.personId, record.personId))
    : [];
  res.setHeader("Cache-Control", "no-store");
  res.json({
    user: { ...publicUser(principal), accountType: record?.accountType || principal.accountType },
    personId: record?.personId || principal.id,
    linkedProfiles,
  });
});

router.get("/odonto-portal/hierarchy/team", async (req, res) => {
  const principal = requireOperational(req as PortalRequest, res);
  if (!principal) return;
  const type = hierarchyType(principal);
  let managerIds: string[] = [];
  if (type === "supervisor") managerIds = await supervisorManagerIds(principal.id);
  if (type === "manager") managerIds = [principal.id];

  const managers = type === "creator"
    ? await db.select().from(odontoPortalUsers).where(eq(odontoPortalUsers.accountType, "manager")).orderBy(odontoPortalUsers.displayName)
    : managerIds.length
      ? await db.select().from(odontoPortalUsers).where(inArray(odontoPortalUsers.id, managerIds)).orderBy(odontoPortalUsers.displayName)
      : [];
  const effectiveManagerIds = managers.map((manager) => manager.id);
  const members = effectiveManagerIds.length
    ? await db.select().from(odontoPortalUsers).where(inArray(odontoPortalUsers.managerId, effectiveManagerIds)).orderBy(odontoPortalUsers.displayName)
    : [];
  const now = Date.now();
  const safe = (user: (typeof managers)[number]) => {
    const { passwordHash: _passwordHash, ...rest } = user;
    return { ...rest, online: user.lastSeenAt.getTime() > now - 90_000 };
  };
  res.setHeader("Cache-Control", "no-store");
  res.json({ managers: managers.map(safe), members: members.map(safe) });
});

router.post("/odonto-portal/hierarchy/team/users", async (req, res) => {
  const principal = requireOperational(req as PortalRequest, res);
  if (!principal) return;
  const username = cleanUsername(req.body?.username);
  const displayName = cleanText(req.body?.displayName, 80);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const requestedManagerId = cleanText(req.body?.managerId, 100);
  if (!usernamePattern.test(username) || !displayName || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    res.status(400).json({ error: "Confira nome, usuário e use senha com letra e número." });
    return;
  }

  const type = hierarchyType(principal);
  let managerId = principal.id;
  if (type === "supervisor") {
    const managerIds = await supervisorManagerIds(principal.id);
    if (!requestedManagerId || !managerIds.includes(requestedManagerId)) {
      res.status(404).json({ error: "Gerente não encontrado." });
      return;
    }
    managerId = requestedManagerId;
  } else if (type === "creator") {
    managerId = requestedManagerId;
  }

  const [manager] = await db.select().from(odontoPortalUsers).where(and(eq(odontoPortalUsers.id, managerId), eq(odontoPortalUsers.accountType, "manager"))).limit(1);
  if (!manager) {
    res.status(400).json({ error: "Selecione um gerente válido." });
    return;
  }
  const existingMembers = await db.select({ id: odontoPortalUsers.id }).from(odontoPortalUsers).where(eq(odontoPortalUsers.managerId, manager.id));
  if (existingMembers.length >= manager.teamMemberLimit) {
    res.status(409).json({ error: `Limite de ${manager.teamMemberLimit} usuários da equipe atingido.` });
    return;
  }
  const [duplicate] = await db.select({ id: odontoPortalUsers.id }).from(odontoPortalUsers).where(eq(odontoPortalUsers.username, username)).limit(1);
  if (duplicate) {
    res.status(409).json({ error: "Este nome de usuário já está em uso." });
    return;
  }

  const id = crypto.randomUUID();
  await db.insert(odontoPortalPeople).values({ id, displayName, email: `${username}@portal.local` });
  const [created] = await db.insert(odontoPortalUsers).values({
    id,
    personId: id,
    username,
    email: `${username}@portal.local`,
    displayName,
    passwordHash: await passwordHash(password),
    role: "member",
    accountType: "member",
    accountStatus: "active",
    managerId: manager.id,
    workspaceOwnerId: manager.workspaceOwnerId || manager.id,
    mustChangePassword: true,
    isActive: true,
    teamMemberLimit: 0,
  }).returning({ id: odontoPortalUsers.id, username: odontoPortalUsers.username, displayName: odontoPortalUsers.displayName, accountType: odontoPortalUsers.accountType, managerId: odontoPortalUsers.managerId });
  await audit(principal.id, "team.user.created", created.id, { managerId: manager.id });
  res.status(201).json({ user: created });
});

router.patch("/odonto-portal/hierarchy/team/users/:id", async (req, res) => {
  const principal = requireOperational(req as PortalRequest, res);
  if (!principal) return;
  const target = await manageableTarget(principal, req.params.id);
  if (!target || target.accountType === "creator" || target.accountType === "supervisor") {
    res.status(404).json({ error: "Conta não encontrada." });
    return;
  }

  const displayName = cleanText(req.body?.displayName, 80) || target.displayName;
  const requestedStatus = cleanText(req.body?.accountStatus, 20);
  const accountStatus = ["active", "suspended"].includes(requestedStatus) ? requestedStatus : target.accountStatus;
  let managerId = target.managerId;
  if (target.accountType === "member" && typeof req.body?.managerId === "string") {
    const candidate = cleanText(req.body.managerId, 100);
    const type = hierarchyType(principal);
    if (type === "manager" && candidate !== principal.id) {
      res.status(404).json({ error: "Gerente não encontrado." });
      return;
    }
    if (type === "supervisor") {
      const managerIds = await supervisorManagerIds(principal.id);
      if (!managerIds.includes(candidate)) {
        res.status(404).json({ error: "Gerente não encontrado." });
        return;
      }
    }
    managerId = candidate;
  }

  const [updated] = await db.update(odontoPortalUsers).set({ displayName, accountStatus, isActive: accountStatus === "active", managerId }).where(eq(odontoPortalUsers.id, target.id)).returning({ id: odontoPortalUsers.id, displayName: odontoPortalUsers.displayName, accountStatus: odontoPortalUsers.accountStatus, managerId: odontoPortalUsers.managerId });
  if (accountStatus !== "active") await invalidateSessions(target.id);
  await audit(principal.id, "team.user.updated", target.id, { accountStatus, managerId });
  res.json({ user: updated });
});

router.put("/odonto-portal/hierarchy/team/users/:id/password", async (req, res) => {
  const principal = requireOperational(req as PortalRequest, res);
  if (!principal) return;
  const target = await manageableTarget(principal, req.params.id);
  if (!target || target.accountType === "creator" || target.accountType === "supervisor") {
    res.status(404).json({ error: "Conta não encontrada." });
    return;
  }
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    res.status(400).json({ error: "Use pelo menos 8 caracteres, com letra e número." });
    return;
  }
  await db.update(odontoPortalUsers).set({ passwordHash: await passwordHash(password), mustChangePassword: true }).where(eq(odontoPortalUsers.id, target.id));
  await invalidateSessions(target.id);
  await audit(principal.id, "team.password.reset", target.id);
  res.status(204).end();
});

router.get("/odonto-portal/hierarchy/admin/overview", async (req, res) => {
  const principal = requireCreator(req as PortalRequest, res);
  if (!principal) return;
  const users = await db.select({
    id: odontoPortalUsers.id,
    personId: odontoPortalUsers.personId,
    username: odontoPortalUsers.username,
    displayName: odontoPortalUsers.displayName,
    accountType: odontoPortalUsers.accountType,
    accountStatus: odontoPortalUsers.accountStatus,
    managerId: odontoPortalUsers.managerId,
    isActive: odontoPortalUsers.isActive,
    teamMemberLimit: odontoPortalUsers.teamMemberLimit,
    lastSeenAt: odontoPortalUsers.lastSeenAt,
  }).from(odontoPortalUsers).orderBy(odontoPortalUsers.displayName);
  const relations = await db.select().from(odontoPortalSupervisorManagers).orderBy(desc(odontoPortalSupervisorManagers.createdAt));
  res.setHeader("Cache-Control", "no-store");
  res.json({ users, relations });
});

router.patch("/odonto-portal/hierarchy/admin/users/:id/account-type", async (req, res) => {
  const principal = requireCreator(req as PortalRequest, res);
  if (!principal) return;
  const requestedType = cleanText(req.body?.accountType, 20);
  if (!["supervisor", "manager", "individual"].includes(requestedType)) {
    res.status(400).json({ error: "Tipo de conta inválido." });
    return;
  }
  const [target] = await db.select().from(odontoPortalUsers).where(eq(odontoPortalUsers.id, req.params.id)).limit(1);
  if (!target || target.accountType === "creator" || target.id === principal.id) {
    res.status(404).json({ error: "Conta não encontrada." });
    return;
  }

  if (target.accountType === "supervisor" && requestedType !== "supervisor") {
    const owned = await supervisorManagerIds(target.id);
    if (owned.length) {
      res.status(409).json({ error: "Remova os gerentes deste supervisor antes de alterar o perfil." });
      return;
    }
  }
  await db.delete(odontoPortalSupervisorManagers).where(eq(odontoPortalSupervisorManagers.managerId, target.id));
  const [updated] = await db.update(odontoPortalUsers).set({
    accountType: requestedType,
    role: "member",
    managerId: null,
    workspaceOwnerId: target.workspaceOwnerId || target.id,
    teamMemberLimit: requestedType === "manager" ? Math.max(1, target.teamMemberLimit || 10) : 0,
  }).where(eq(odontoPortalUsers.id, target.id)).returning({ id: odontoPortalUsers.id, accountType: odontoPortalUsers.accountType });
  await invalidateSessions(target.id);
  await audit(principal.id, "admin.account_type.changed", target.id, { from: target.accountType, to: requestedType });
  res.json({ user: updated });
});

router.put("/odonto-portal/hierarchy/admin/supervisors/:supervisorId/managers/:managerId", async (req, res) => {
  const principal = requireCreator(req as PortalRequest, res);
  if (!principal) return;
  const [supervisor] = await db.select({ id: odontoPortalUsers.id, accountType: odontoPortalUsers.accountType }).from(odontoPortalUsers).where(eq(odontoPortalUsers.id, req.params.supervisorId)).limit(1);
  const [manager] = await db.select({ id: odontoPortalUsers.id, accountType: odontoPortalUsers.accountType }).from(odontoPortalUsers).where(eq(odontoPortalUsers.id, req.params.managerId)).limit(1);
  if (supervisor?.accountType !== "supervisor" || manager?.accountType !== "manager") {
    res.status(400).json({ error: "Supervisor ou gerente inválido." });
    return;
  }
  await db.delete(odontoPortalSupervisorManagers).where(eq(odontoPortalSupervisorManagers.managerId, manager.id));
  await db.insert(odontoPortalSupervisorManagers).values({ supervisorId: supervisor.id, managerId: manager.id, createdBy: principal.id });
  await audit(principal.id, "admin.manager.assigned", manager.id, { supervisorId: supervisor.id });
  res.status(204).end();
});

router.delete("/odonto-portal/hierarchy/admin/supervisors/:supervisorId/managers/:managerId", async (req, res) => {
  const principal = requireCreator(req as PortalRequest, res);
  if (!principal) return;
  await db.delete(odontoPortalSupervisorManagers).where(and(eq(odontoPortalSupervisorManagers.supervisorId, req.params.supervisorId), eq(odontoPortalSupervisorManagers.managerId, req.params.managerId)));
  await audit(principal.id, "admin.manager.unassigned", req.params.managerId, { supervisorId: req.params.supervisorId });
  res.status(204).end();
});

router.post("/odonto-portal/hierarchy/admin/link-person", async (req, res) => {
  const principal = requireCreator(req as PortalRequest, res);
  if (!principal) return;
  const primaryUserId = cleanText(req.body?.primaryUserId, 100);
  const secondaryUserId = cleanText(req.body?.secondaryUserId, 100);
  if (!primaryUserId || !secondaryUserId || primaryUserId === secondaryUserId) {
    res.status(400).json({ error: "Selecione dois logins diferentes." });
    return;
  }
  const users = await db.select().from(odontoPortalUsers).where(inArray(odontoPortalUsers.id, [primaryUserId, secondaryUserId]));
  if (users.length !== 2) {
    res.status(404).json({ error: "Conta não encontrada." });
    return;
  }
  const primary = users.find((item) => item.id === primaryUserId)!;
  const secondary = users.find((item) => item.id === secondaryUserId)!;
  const personId = primary.personId || primary.id;
  const [person] = await db.select().from(odontoPortalPeople).where(eq(odontoPortalPeople.id, personId)).limit(1);
  if (!person) await db.insert(odontoPortalPeople).values({ id: personId, displayName: primary.displayName, email: primary.email });
  await db.update(odontoPortalUsers).set({ personId, displayName: primary.displayName }).where(inArray(odontoPortalUsers.id, [primary.id, secondary.id]));
  await db.update(odontoPortalPeople).set({ displayName: primary.displayName, updatedAt: new Date() }).where(eq(odontoPortalPeople.id, personId));
  await audit(principal.id, "admin.person.linked", secondary.id, { primaryUserId, personId });
  res.status(204).end();
});

router.post("/odonto-portal/hierarchy/admin/unlink-person", async (req, res) => {
  const principal = requireCreator(req as PortalRequest, res);
  if (!principal) return;
  const userId = cleanText(req.body?.userId, 100);
  const [target] = await db.select().from(odontoPortalUsers).where(eq(odontoPortalUsers.id, userId)).limit(1);
  if (!target) {
    res.status(404).json({ error: "Conta não encontrada." });
    return;
  }
  const personId = crypto.randomUUID();
  await db.insert(odontoPortalPeople).values({ id: personId, displayName: target.displayName, email: target.email });
  await db.update(odontoPortalUsers).set({ personId }).where(eq(odontoPortalUsers.id, target.id));
  await audit(principal.id, "admin.person.unlinked", target.id, { personId });
  res.status(204).end();
});

router.get("/odonto-portal/hierarchy/admin/audit", async (req, res) => {
  if (!requireCreator(req as PortalRequest, res)) return;
  const entries = await db.select().from(odontoPortalAuditLog).orderBy(desc(odontoPortalAuditLog.createdAt)).limit(100);
  res.setHeader("Cache-Control", "no-store");
  res.json({ entries });
});

export default router;
