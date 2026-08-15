import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  odontoPortalNotifications,
  odontoPortalUsers,
} from "@workspace/db";
import {
  attachPortalUser,
  bootstrapAdmin,
  loginRateLimit,
  passwordHash,
  requirePortalManager,
  type PortalRequest,
} from "../lib/odontoPortalAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,31}$/;

const cleanText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const cleanUsername = (value: unknown) =>
  cleanText(value, 32).toLocaleLowerCase("pt-BR");

router.use((req, res, next) => {
  void bootstrapAdmin()
    .then(() => attachPortalUser(req as PortalRequest, res, next))
    .catch(next);
});

/**
 * Public registration policy.
 *
 * The requester never chooses an account type. Every public request enters as a
 * pending, inactive neutral `member`. The creator must explicitly change it to
 * `manager` or `individual` before activation.
 */
router.post(
  "/odonto-portal/auth/register",
  loginRateLimit(),
  async (req, res) => {
    const username = cleanUsername(req.body?.username);
    const displayName = cleanText(req.body?.displayName, 80);
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!usernamePattern.test(username) || !displayName || password.length < 8) {
      res.status(400).json({
        error: "Informe nome, usuário e uma senha com pelo menos 8 caracteres.",
      });
      return;
    }

    try {
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
      await db.insert(odontoPortalUsers).values({
        id,
        username,
        email: `${username}@portal.local`,
        displayName,
        passwordHash: await passwordHash(password),
        role: "member",
        accountType: "member",
        accountStatus: "pending",
        managerId: null,
        workspaceOwnerId: id,
        mustChangePassword: false,
        isActive: false,
        teamMemberLimit: 0,
      });

      const creators = await db
        .select({ id: odontoPortalUsers.id })
        .from(odontoPortalUsers)
        .where(
          and(
            eq(odontoPortalUsers.accountType, "creator"),
            eq(odontoPortalUsers.isActive, true),
          ),
        );

      if (creators.length) {
        await db.insert(odontoPortalNotifications).values(
          creators.map((creator) => ({
            id: crypto.randomUUID(),
            userId: creator.id,
            title: "Novo pedido de acesso",
            body: `${displayName} (@${username}) solicitou acesso ao portal. Defina o tipo de ambiente antes de aprovar.`,
            kind: "access_request",
          })),
        );
      }

      res.status(202).json({
        message:
          "Pedido enviado. O administrador definirá seu tipo de acesso durante a aprovação.",
      });
    } catch (error) {
      logger.error({ err: error }, "Unable to request Odonto portal access");
      res.status(503).json({ error: "Não foi possível enviar o pedido agora." });
    }
  },
);

/**
 * Prevent a pending neutral request from being activated before the creator has
 * explicitly assigned `manager` or `individual`.
 */
router.patch("/odonto-portal/admin/users/:id", async (req, res, next) => {
  const wantsActivation =
    req.body?.accountStatus === "active" || req.body?.isActive === true;

  if (!wantsActivation) {
    next();
    return;
  }

  const principal = requirePortalManager(req as PortalRequest, res);
  if (!principal) return;

  if (principal.accountType !== "creator") {
    next();
    return;
  }

  const [target] = await db
    .select({
      accountType: odontoPortalUsers.accountType,
      accountStatus: odontoPortalUsers.accountStatus,
    })
    .from(odontoPortalUsers)
    .where(eq(odontoPortalUsers.id, req.params.id))
    .limit(1);

  if (
    target?.accountStatus === "pending" &&
    !["manager", "individual"].includes(target.accountType)
  ) {
    res.status(400).json({
      error:
        "Defina o tipo de acesso como Gerente ou Individual antes de aprovar esta conta.",
    });
    return;
  }

  next();
});

export default router;
