import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, odontoPortalUsers } from "@workspace/db";
import {
  attachPortalUser,
  bootstrapAdmin,
  requirePortalUser,
  type PortalRequest,
} from "../lib/odontoPortalAuth";

const router: IRouter = Router();

router.patch("/odonto-portal/hierarchy/team/users/:id", (req, _res, next) => {
  if (
    req.body &&
    typeof req.body === "object" &&
    typeof req.body.isActive === "boolean" &&
    typeof req.body.accountStatus !== "string"
  ) {
    req.body.accountStatus = req.body.isActive ? "active" : "suspended";
  }
  next();
});

router.post("/odonto-portal/hierarchy/admin/link-person", (req, _res, next) => {
  if (
    req.body &&
    typeof req.body === "object" &&
    typeof req.body.secondaryUserId !== "string" &&
    typeof req.body.linkedUserId === "string"
  ) {
    req.body.secondaryUserId = req.body.linkedUserId;
  }
  next();
});

router.patch(
  "/odonto-portal/hierarchy/admin/users/:id/account-type",
  async (req, res, next) => {
    if (req.body?.accountType !== "member") return next();

    await bootstrapAdmin();
    await new Promise<void>((resolve, reject) => {
      attachPortalUser(req as PortalRequest, res, (error?: unknown) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const principal = requirePortalUser(req as PortalRequest, res);
    if (!principal) return;
    if (principal.accountType !== "creator") {
      res.status(403).json({ error: "Esta área é exclusiva do administrador do sistema." });
      return;
    }

    const [target] = await db
      .select({
        id: odontoPortalUsers.id,
        accountType: odontoPortalUsers.accountType,
        managerId: odontoPortalUsers.managerId,
      })
      .from(odontoPortalUsers)
      .where(eq(odontoPortalUsers.id, req.params.id))
      .limit(1);

    if (!target) {
      res.status(404).json({ error: "Conta não encontrada." });
      return;
    }
    if (target.accountType !== "member") {
      res.status(400).json({
        error: "Para transformar uma conta em membro, vincule-a a um gerente pela gestão da equipe.",
      });
      return;
    }

    res.json({ user: target });
  },
);

export default router;
