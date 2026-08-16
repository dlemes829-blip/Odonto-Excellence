import { db, odontoPortalUserStates, odontoPortalStates, odontoPortalUsers } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter, type Response } from "express";
import { logger } from "../lib/logger";
import {
  requirePortalManager,
  requirePortalUser,
  type PortalRequest,
} from "../lib/odontoPortalAuth";

const router: IRouter = Router();
const MAX_STATE_BYTES = 1_000_000;
const GLOBAL_SETTINGS_KEY = "global-settings";

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

/**
 * Global portal settings (e.g. the "chat ao vivo" feature flag). These are
 * NOT per-user - they apply to the whole portal, controlled by the
 * creator from the admin panel. Reuses the odonto_portal_states table,
 * which existed in the schema but had no route wired to it until now.
 */
router.get("/odonto-portal/settings", async (req, res) => {
  const user = requirePortalUser(req as PortalRequest, res);
  if (!user) return;
  try {
    const [row] = await db
      .select({ state: odontoPortalStates.state })
      .from(odontoPortalStates)
      .where(eq(odontoPortalStates.portalKey, GLOBAL_SETTINGS_KEY))
      .limit(1);
    const state = (row?.state ?? {}) as { chatEnabled?: boolean };
    res.setHeader("Cache-Control", "no-store");
    res.json({ chatEnabled: state.chatEnabled === true });
  } catch (error) {
    logger.error({ err: error }, "Unable to read Odonto portal settings");
    res.status(503).json({ error: "Não foi possível carregar as configurações." });
  }
});

router.patch("/odonto-portal/admin/settings", async (req, res) => {
  const principal = requirePortalManager(req as PortalRequest, res);
  if (!principal) return;
  if (principal.accountType !== "creator") {
    res
      .status(403)
      .json({ error: "Somente o criador altera as configurações globais." });
    return;
  }
  const chatEnabled = req.body?.chatEnabled === true;
  try {
    const [existing] = await db
      .select({ revision: odontoPortalStates.revision })
      .from(odontoPortalStates)
      .where(eq(odontoPortalStates.portalKey, GLOBAL_SETTINGS_KEY))
      .limit(1);
    if (existing) {
      await db
        .update(odontoPortalStates)
        .set({
          state: { chatEnabled },
          revision: existing.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(odontoPortalStates.portalKey, GLOBAL_SETTINGS_KEY));
    } else {
      await db.insert(odontoPortalStates).values({
        portalKey: GLOBAL_SETTINGS_KEY,
        state: { chatEnabled },
        revision: 1,
      });
    }
    res.json({ chatEnabled });
  } catch (error) {
    logger.error({ err: error }, "Unable to update Odonto portal settings");
    res.status(503).json({ error: "Não foi possível salvar a configuração." });
  }
});

/**
 * Team presence for the chat contact list: who is online right now and
 * when each teammate was last seen. This reuses the SAME lastSeenAt
 * column and 90-second "online" threshold that already powers the online
 * indicator in the admin panel - it is real, live data (kept fresh by the
 * heartbeat the app already sends every 45s), not a mock.
 */
router.get("/odonto-portal/team/presence", async (req, res) => {
  const user = requirePortalUser(req as PortalRequest, res);
  if (!user) return;
  try {
    const rows = await db
      .select({
        id: odontoPortalUsers.id,
        displayName: odontoPortalUsers.displayName,
        lastSeenAt: odontoPortalUsers.lastSeenAt,
      })
      .from(odontoPortalUsers)
      .where(eq(odontoPortalUsers.workspaceOwnerId, user.workspaceOwnerId));
    res.setHeader("Cache-Control", "no-store");
    res.json({
      teammates: rows.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        online: row.lastSeenAt.getTime() > Date.now() - 90_000,
        lastSeenAt: row.lastSeenAt.toISOString(),
      })),
    });
  } catch (error) {
    logger.error({ err: error }, "Unable to read Odonto team presence");
    res.status(503).json({ error: "Não foi possível carregar a presença da equipe." });
  }
});

export default router;
