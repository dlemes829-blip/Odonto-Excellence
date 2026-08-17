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
const TRAINING_METADATA_PREFIX = "training-metadata:";

type StateEnvelope = { state: Record<string, unknown>; revision: number };
type TrainingMetadataItem = {
  title: string;
  durationMinutes: number;
  notes: string;
  updatedAt: string;
};
type TrainingMetadataState = {
  videos: Record<string, TrainingMetadataItem>;
};

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

function trainingMetadataKey(workspaceOwnerId: string) {
  return `${TRAINING_METADATA_PREFIX}${workspaceOwnerId}`;
}

function normalizeTrainingMetadata(value: unknown): TrainingMetadataState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { videos: {} };
  const source = value as { videos?: unknown };
  if (!source.videos || typeof source.videos !== "object" || Array.isArray(source.videos)) {
    return { videos: {} };
  }
  const videos: Record<string, TrainingMetadataItem> = {};
  for (const [id, raw] of Object.entries(source.videos as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Partial<TrainingMetadataItem>;
    const title = typeof item.title === "string" ? item.title.trim().slice(0, 120) : "";
    const durationMinutes = Math.max(1, Math.min(720, Math.round(Number(item.durationMinutes) || 1)));
    const notes = typeof item.notes === "string" ? item.notes.trim().slice(0, 4000) : "";
    const updatedAt = typeof item.updatedAt === "string" ? item.updatedAt : new Date(0).toISOString();
    if (!title) continue;
    videos[id] = { title, durationMinutes, notes, updatedAt };
  }
  return { videos };
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
 * Durable metadata for training videos. Notes are intentionally kept outside
 * the generic dashboard document so the regular store normalizer can never
 * erase them. The record is scoped by workspace and is suitable for future
 * learning-agent retrieval.
 */
router.get("/odonto-portal/training-metadata", async (req, res) => {
  const user = requirePortalUser(req as PortalRequest, res);
  if (!user) return;
  try {
    const [row] = await db
      .select({ state: odontoPortalStates.state })
      .from(odontoPortalStates)
      .where(eq(odontoPortalStates.portalKey, trainingMetadataKey(user.workspaceOwnerId)))
      .limit(1);
    res.setHeader("Cache-Control", "no-store");
    res.json(normalizeTrainingMetadata(row?.state));
  } catch (error) {
    logger.error({ err: error }, "Unable to read training metadata");
    res.status(503).json({ error: "Não foi possível carregar os dados dos vídeos." });
  }
});

router.put("/odonto-portal/training-metadata/:videoId", async (req, res) => {
  const user = requirePortalUser(req as PortalRequest, res);
  if (!user) return;

  const videoId = typeof req.params.videoId === "string" ? req.params.videoId.trim().slice(0, 160) : "";
  const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 120) : "";
  const durationMinutes = Math.max(1, Math.min(720, Math.round(Number(req.body?.durationMinutes) || 0)));
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim().slice(0, 4000) : "";

  if (!videoId || !title || !Number.isFinite(durationMinutes)) {
    res.status(400).json({ error: "Informe título e duração válidos." });
    return;
  }

  const portalKey = trainingMetadataKey(user.workspaceOwnerId);
  try {
    const [existing] = await db
      .select({ state: odontoPortalStates.state, revision: odontoPortalStates.revision })
      .from(odontoPortalStates)
      .where(eq(odontoPortalStates.portalKey, portalKey))
      .limit(1);

    const current = normalizeTrainingMetadata(existing?.state);
    const item: TrainingMetadataItem = {
      title,
      durationMinutes,
      notes,
      updatedAt: new Date().toISOString(),
    };
    const nextState: TrainingMetadataState = {
      videos: { ...current.videos, [videoId]: item },
    };

    if (existing) {
      await db
        .update(odontoPortalStates)
        .set({
          state: nextState,
          revision: existing.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(odontoPortalStates.portalKey, portalKey));
    } else {
      await db.insert(odontoPortalStates).values({
        portalKey,
        state: nextState,
        revision: 1,
      });
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({ video: item });
  } catch (error) {
    logger.error({ err: error, videoId }, "Unable to save training metadata");
    res.status(503).json({ error: "Não foi possível salvar os dados do vídeo." });
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
 * Chat contact list, scoped by account hierarchy - this is real
 * server-side access control, not just a UI filter:
 *   - creator (the developer account): sees every other active user.
 *   - manager: sees their own team members + the developer.
 *   - member (belongs to a manager): sees their manager + the developer.
 *   - individual: sees only the developer.
 * Presence (online / lastSeenAt) reuses the same heartbeat-based data
 * that already powers the admin panel's online indicator.
 */
router.get("/odonto-portal/team/chat-contacts", async (req, res) => {
  const user = requirePortalUser(req as PortalRequest, res);
  if (!user) return;
  try {
    const rows = await db
      .select({
        id: odontoPortalUsers.id,
        displayName: odontoPortalUsers.displayName,
        accountType: odontoPortalUsers.accountType,
        managerId: odontoPortalUsers.managerId,
        isActive: odontoPortalUsers.isActive,
        lastSeenAt: odontoPortalUsers.lastSeenAt,
      })
      .from(odontoPortalUsers);

    const isDeveloper = (row: (typeof rows)[number]) =>
      row.accountType === "creator";

    let contacts: typeof rows;
    if (user.accountType === "creator") {
      contacts = rows.filter((row) => row.isActive && row.id !== user.id);
    } else if (user.accountType === "manager") {
      contacts = rows.filter(
        (row) => row.isActive && (isDeveloper(row) || row.managerId === user.id),
      );
    } else if (user.accountType === "member") {
      contacts = rows.filter(
        (row) =>
          row.isActive && (isDeveloper(row) || row.id === user.managerId),
      );
    } else {
      // "individual" accounts only ever talk to the developer.
      contacts = rows.filter((row) => row.isActive && isDeveloper(row));
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({
      contacts: contacts.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        isDeveloper: isDeveloper(row),
        online: row.lastSeenAt.getTime() > Date.now() - 90_000,
        lastSeenAt: row.lastSeenAt.toISOString(),
      })),
    });
  } catch (error) {
    logger.error({ err: error }, "Unable to read Odonto chat contacts");
    res
      .status(503)
      .json({ error: "Não foi possível carregar os contatos do chat." });
  }
});

export default router;
