import { db, odontoPortalStates } from "@workspace/db";
import { sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { requirePortalUser, type PortalRequest } from "../lib/odontoPortalAuth";

const router: IRouter = Router();
const TRAINING_METADATA_PREFIX = "training-metadata:";
const VIDEO_ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;

type TrainingMetadataItem = {
  title: string;
  durationMinutes: number;
  notes: string;
  updatedAt: string;
};

function trainingMetadataKey(workspaceOwnerId: string) {
  return `${TRAINING_METADATA_PREFIX}${workspaceOwnerId}`;
}

/**
 * Fast path for editing a single training video.
 *
 * The legacy implementation reads the entire metadata JSON document, merges
 * one item in Node and writes the entire document back. This route performs an
 * atomic JSONB merge in PostgreSQL instead: one round-trip, no lost-update
 * window, and response time does not grow linearly with the number of videos.
 * It is mounted before the legacy route and intentionally owns the same path.
 */
router.put("/odonto-portal/training-metadata/:videoId", async (req, res) => {
  const user = requirePortalUser(req as PortalRequest, res);
  if (!user) return;

  const videoId = typeof req.params.videoId === "string" ? req.params.videoId.trim() : "";
  const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 120) : "";
  const durationRaw = Number(req.body?.durationMinutes);
  const durationMinutes = Math.max(1, Math.min(720, Math.round(durationRaw || 0)));
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim().slice(0, 4000) : "";

  if (!VIDEO_ID_PATTERN.test(videoId) || !title || !Number.isFinite(durationRaw) || durationRaw <= 0) {
    res.status(400).json({ error: "Informe título, vídeo e duração válidos." });
    return;
  }

  const item: TrainingMetadataItem = {
    title,
    durationMinutes,
    notes,
    updatedAt: new Date().toISOString(),
  };
  const portalKey = trainingMetadataKey(user.workspaceOwnerId);
  const initialState = { videos: { [videoId]: item } };
  const itemJson = JSON.stringify(item);

  try {
    await db
      .insert(odontoPortalStates)
      .values({ portalKey, state: initialState, revision: 1 })
      .onConflictDoUpdate({
        target: odontoPortalStates.portalKey,
        set: {
          state: sql`jsonb_set(
            coalesce(${odontoPortalStates.state}, '{}'::jsonb),
            '{videos}',
            coalesce(${odontoPortalStates.state}->'videos', '{}'::jsonb) || jsonb_build_object(${videoId}, ${itemJson}::jsonb),
            true
          )`,
          revision: sql`${odontoPortalStates.revision} + 1`,
          updatedAt: new Date(),
        },
      });

    res.setHeader("Cache-Control", "no-store");
    res.json({ video: item });
  } catch (error) {
    logger.error({ err: error, videoId }, "Unable to atomically save training metadata");
    res.status(503).json({ error: "Não foi possível salvar os dados do vídeo." });
  }
});

export default router;
