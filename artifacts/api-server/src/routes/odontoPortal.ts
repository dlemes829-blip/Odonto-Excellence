import { db, odontoPortalUserStates } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter, type Response } from "express";
import { logger } from "../lib/logger";
import { requirePortalUser, type PortalRequest } from "../lib/odontoPortalAuth";

const router: IRouter = Router();
const MAX_STATE_BYTES = 1_000_000;

type StateEnvelope = { state: Record<string, unknown>; revision: number };

function parseStateEnvelope(value: unknown): StateEnvelope | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { state, revision } = value as { state?: unknown; revision?: unknown };
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  if (!Number.isInteger(revision) || (revision as number) < 0) return null;
  return { state: state as Record<string, unknown>, revision: revision as number };
}

function sendState(res: Response, state: Record<string, unknown> | null, revision: number) {
  res.setHeader("Cache-Control", "no-store");
  res.json({ state, revision });
}

router.get("/odonto-portal/state", async (req, res) => {
  const user = requirePortalUser(req as PortalRequest, res);
  if (!user) return;
  try {
    const [current] = await db
      .select({ state: odontoPortalUserStates.state, revision: odontoPortalUserStates.revision })
      .from(odontoPortalUserStates)
      .where(eq(odontoPortalUserStates.userId, user.workspaceOwnerId))
      .limit(1);

    sendState(res, current?.state ?? null, current?.revision ?? 0);
  } catch (error) {
    logger.error({ err: error }, "Unable to read Odonto portal state");
    res.status(503).json({ error: "A sincronização está indisponível no momento." });
  }
});

router.put("/odonto-portal/state", async (req, res) => {
  const user = requirePortalUser(req as PortalRequest, res);
  if (!user) return;
  const payload = parseStateEnvelope(req.body);
  if (!payload) {
    res.status(400).json({ error: "Os dados enviados são inválidos." });
    return;
  }

  const bytes = Buffer.byteLength(JSON.stringify(payload.state), "utf8");
  if (bytes > MAX_STATE_BYTES) {
    res.status(413).json({ error: "O conjunto de dados ultrapassa o limite permitido." });
    return;
  }

  try {
    const { state, revision } = payload;
    const [current] = await db
      .select({ revision: odontoPortalUserStates.revision })
      .from(odontoPortalUserStates)
      .where(eq(odontoPortalUserStates.userId, user.workspaceOwnerId))
      .limit(1);

    if (!current) {
      if (revision !== 0) {
        res.status(409).json({ error: "Os dados foram atualizados por outra sessão.", revision: 0 });
        return;
      }
      await db.insert(odontoPortalUserStates).values({ userId: user.workspaceOwnerId, state, revision: 1 });
      sendState(res, state, 1);
      return;
    }

    if (current.revision !== revision) {
      res.status(409).json({ error: "Os dados foram atualizados por outra sessão.", revision: current.revision });
      return;
    }

    const nextRevision = revision + 1;
    const updated = await db
      .update(odontoPortalUserStates)
      .set({ state, revision: nextRevision, updatedAt: new Date() })
      .where(and(eq(odontoPortalUserStates.userId, user.workspaceOwnerId), eq(odontoPortalUserStates.revision, revision)))
      .returning({ revision: odontoPortalUserStates.revision });

    if (!updated.length) {
      res.status(409).json({ error: "Os dados foram atualizados por outra sessão." });
      return;
    }

    sendState(res, state, nextRevision);
  } catch (error) {
    logger.error({ err: error }, "Unable to save Odonto portal state");
    res.status(503).json({ error: "Não foi possível salvar as alterações agora." });
  }
});

export default router;
