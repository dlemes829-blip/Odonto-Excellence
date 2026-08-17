import { eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, odontoPortalUserStates } from "@workspace/db";
import { requirePortalUser, type PortalRequest } from "../lib/odontoPortalAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();
let schemaReady = false;

function saoPauloDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

async function ensureSchema() {
  if (schemaReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS odonto_portal_daily_archives (
      id text PRIMARY KEY,
      workspace_owner_id text NOT NULL,
      archive_date text NOT NULL,
      snapshot jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS odonto_portal_daily_archives_workspace_date_idx
    ON odonto_portal_daily_archives (workspace_owner_id, archive_date)
  `);
  schemaReady = true;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasDailyData(collaborators: Array<Record<string, unknown>>) {
  return collaborators.some((person) => {
    const appointments = Array.isArray(person.appointments) ? person.appointments.length : 0;
    return (
      appointments > 0 ||
      Number(person.calls) > 0 ||
      Number(person.messages) > 0 ||
      Number(person.whatsapp) > 0 ||
      Number(person.conversions) > 0 ||
      Number(person.refusals) > 0
    );
  });
}

function makeArchive(date: string, collaborators: Array<Record<string, unknown>>) {
  return {
    id: `archive-server-${date}`,
    date,
    closedAt: "virada automática",
    appointments: collaborators.flatMap((person) =>
      Array.isArray(person.appointments)
        ? person.appointments.map((appointment) => ({ ...(objectRecord(appointment) ?? {}) }))
        : [],
    ),
    collaboratorName: "Equipe Odonto Excellence",
    collaborators: collaborators.map((person) => ({
      ...person,
      appointments: Array.isArray(person.appointments) ? [...person.appointments] : [],
    })),
  };
}

async function persistArchive(workspaceOwnerId: string, archive: Record<string, unknown>) {
  const date = typeof archive.date === "string" ? archive.date : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const id = `${workspaceOwnerId}:${date}`;
  const snapshot = JSON.stringify(archive);
  await db.execute(sql`
    INSERT INTO odonto_portal_daily_archives
      (id, workspace_owner_id, archive_date, snapshot, created_at, updated_at)
    VALUES
      (${id}, ${workspaceOwnerId}, ${date}, ${snapshot}::jsonb, now(), now())
    ON CONFLICT (workspace_owner_id, archive_date)
    DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = now()
  `);
}

async function persistArchivesFromState(workspaceOwnerId: string, stateValue: unknown) {
  const state = objectRecord(stateValue);
  if (!state || !Array.isArray(state.archives)) return;
  for (const raw of state.archives) {
    const archive = objectRecord(raw);
    if (archive) await persistArchive(workspaceOwnerId, archive);
  }
}

function rolloverState(stateValue: unknown) {
  const state = objectRecord(stateValue);
  if (!state) return null;
  const today = saoPauloDateKey();
  const activeDate = typeof state.activeDate === "string" ? state.activeDate : today;
  if (activeDate === today || !/^\d{4}-\d{2}-\d{2}$/.test(activeDate)) return null;

  const collaborators = Array.isArray(state.collaborators)
    ? state.collaborators.map((item) => objectRecord(item)).filter(Boolean) as Array<Record<string, unknown>>
    : [];
  const existingArchives = Array.isArray(state.archives)
    ? state.archives.map((item) => objectRecord(item)).filter(Boolean) as Array<Record<string, unknown>>
    : [];
  const archive = makeArchive(activeDate, collaborators);
  const hasExistingDate = existingArchives.some((item) => item.date === activeDate);
  const shouldArchive = hasDailyData(collaborators) && !hasExistingDate;
  const nextArchives = shouldArchive ? [archive, ...existingArchives] : existingArchives;
  const resetCollaborators = collaborators.map((person) => ({
    ...person,
    calls: 0,
    messages: 0,
    whatsapp: 0,
    conversions: 0,
    refusals: 0,
    appointments: [],
  }));

  return {
    state: {
      ...state,
      activeDate: today,
      collaborators: resetCollaborators,
      archives: nextArchives,
    },
    archive: shouldArchive ? archive : null,
  };
}

/**
 * The server owns day rollover. Even if no browser is open at midnight, the
 * first request on the next day archives the previous work before clearing the
 * active counters. This removes the old dependency on a client-side reload.
 */
router.get("/odonto-portal/state", async (req, res, next) => {
  const user = requirePortalUser(req as PortalRequest, res);
  if (!user) return;
  try {
    await ensureSchema();
    const [row] = await db
      .select({ state: odontoPortalUserStates.state, revision: odontoPortalUserStates.revision })
      .from(odontoPortalUserStates)
      .where(eq(odontoPortalUserStates.userId, user.workspaceOwnerId))
      .limit(1);
    if (!row) return next();

    const rolled = rolloverState(row.state);
    if (!rolled) {
      await persistArchivesFromState(user.workspaceOwnerId, row.state);
      res.setHeader("Cache-Control", "no-store");
      res.json({ state: row.state, revision: row.revision });
      return;
    }

    if (rolled.archive) await persistArchive(user.workspaceOwnerId, rolled.archive);
    await persistArchivesFromState(user.workspaceOwnerId, rolled.state);
    const nextRevision = row.revision + 1;
    await db
      .update(odontoPortalUserStates)
      .set({ state: rolled.state, revision: nextRevision, updatedAt: new Date() })
      .where(eq(odontoPortalUserStates.userId, user.workspaceOwnerId));
    res.setHeader("Cache-Control", "no-store");
    res.json({ state: rolled.state, revision: nextRevision });
  } catch (error) {
    logger.error({ err: error }, "Unable to apply durable Odonto day rollover");
    next();
  }
});

/** Persist every archive already present in a normal state save as a durable copy. */
router.put("/odonto-portal/state", async (req, _res, next) => {
  const user = (req as PortalRequest).portalUser;
  if (!user) return next();
  try {
    await ensureSchema();
    await persistArchivesFromState(user.workspaceOwnerId, req.body?.state);
  } catch (error) {
    logger.error({ err: error }, "Unable to persist Odonto archive ledger");
  }
  next();
});

router.get("/odonto-portal/history/durable", async (req, res) => {
  const user = requirePortalUser(req as PortalRequest, res);
  if (!user) return;
  try {
    await ensureSchema();
    const result = await db.execute(sql`
      SELECT archive_date, snapshot, updated_at
      FROM odonto_portal_daily_archives
      WHERE workspace_owner_id = ${user.workspaceOwnerId}
      ORDER BY archive_date DESC
      LIMIT 730
    `);
    res.setHeader("Cache-Control", "no-store");
    res.json({ archives: result.rows });
  } catch (error) {
    logger.error({ err: error }, "Unable to read durable Odonto history");
    res.status(503).json({ error: "Não foi possível carregar o histórico agora." });
  }
});

export default router;
