import { sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requirePortalUser, type PortalRequest } from "../lib/odontoPortalAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

type Appointment = {
  id: string;
  patient: string;
  date: string;
  time: string;
  note: string;
  status: "confirmed" | "pending" | "rescheduled";
};

type MutationBody = {
  operation?: unknown;
  collaboratorId?: unknown;
  appointmentId?: unknown;
  appointment?: unknown;
};

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanAppointment(value: unknown): Appointment | null {
  const source = objectRecord(value);
  if (!source) return null;
  const id = cleanText(source.id, 120);
  const patient = cleanText(source.patient, 160);
  const date = cleanText(source.date, 10);
  const time = cleanText(source.time, 5);
  const note = cleanText(source.note, 1000);
  const rawStatus = cleanText(source.status, 20);
  const status = ["confirmed", "pending", "rescheduled"].includes(rawStatus)
    ? (rawStatus as Appointment["status"])
    : "pending";
  if (!id || !patient || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    return null;
  return { id, patient, date, time, note, status };
}

function sortAppointments(items: Array<Record<string, unknown>>) {
  return [...items].sort((left, right) => {
    const a = `${String(left.date ?? "")}${String(left.time ?? "")}${String(left.id ?? "")}`;
    const b = `${String(right.date ?? "")}${String(right.time ?? "")}${String(right.id ?? "")}`;
    return a.localeCompare(b);
  });
}

router.post("/odonto-portal/appointments/mutate", async (req, res) => {
  const user = requirePortalUser(req as PortalRequest, res);
  if (!user) return;

  const body = (req.body ?? {}) as MutationBody;
  const operation = cleanText(body.operation, 20);
  const collaboratorId = cleanText(body.collaboratorId, 120);
  const appointmentId = cleanText(body.appointmentId, 120);
  const appointment = cleanAppointment(body.appointment);

  if (!collaboratorId || !["upsert", "delete"].includes(operation)) {
    res.status(400).json({ error: "Operação de avaliação inválida." });
    return;
  }
  if (operation === "upsert" && !appointment) {
    res.status(400).json({ error: "Preencha paciente, data e horário da avaliação." });
    return;
  }
  if (operation === "delete" && !appointmentId) {
    res.status(400).json({ error: "Avaliação inválida." });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const locked = await tx.execute(sql`
        SELECT state, revision
        FROM odonto_portal_user_states
        WHERE user_id = ${user.workspaceOwnerId}
        FOR UPDATE
      `);
      const row = locked.rows[0] as { state?: unknown; revision?: unknown } | undefined;
      if (!row) throw new Error("state_not_found");

      const state = objectRecord(row.state);
      if (!state) throw new Error("invalid_state");
      const collaborators = Array.isArray(state.collaborators)
        ? state.collaborators.map((item) => objectRecord(item)).filter(Boolean) as Array<Record<string, unknown>>
        : [];
      const targetIndex = collaborators.findIndex((item) => item.id === collaboratorId);
      if (targetIndex < 0) throw new Error("collaborator_not_found");

      const target = collaborators[targetIndex];
      const currentAppointments = Array.isArray(target.appointments)
        ? target.appointments.map((item) => objectRecord(item)).filter(Boolean) as Array<Record<string, unknown>>
        : [];

      let nextAppointments: Array<Record<string, unknown>>;
      if (operation === "delete") {
        nextAppointments = currentAppointments.filter((item) => item.id !== appointmentId);
      } else {
        const normalized = appointment as unknown as Record<string, unknown>;
        const existingIndex = currentAppointments.findIndex((item) => item.id === appointment!.id);
        nextAppointments = [...currentAppointments];
        if (existingIndex >= 0) nextAppointments[existingIndex] = normalized;
        else nextAppointments.push(normalized);
      }

      const nextCollaborators = [...collaborators];
      nextCollaborators[targetIndex] = {
        ...target,
        appointments: sortAppointments(nextAppointments),
      };
      const nextState = { ...state, collaborators: nextCollaborators };
      const currentRevision = Number(row.revision) || 0;
      const nextRevision = currentRevision + 1;

      await tx.execute(sql`
        UPDATE odonto_portal_user_states
        SET state = ${JSON.stringify(nextState)}::jsonb,
            revision = ${nextRevision},
            updated_at = now()
        WHERE user_id = ${user.workspaceOwnerId}
      `);

      return { state: nextState, revision: nextRevision };
    });

    res.setHeader("Cache-Control", "no-store");
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "state_not_found") {
      res.status(409).json({ error: "O ambiente ainda não foi inicializado." });
      return;
    }
    if (message === "collaborator_not_found") {
      res.status(404).json({ error: "Perfil responsável pela avaliação não encontrado." });
      return;
    }
    if (message === "invalid_state") {
      res.status(409).json({ error: "O estado do ambiente precisa ser recarregado." });
      return;
    }
    logger.error({ err: error, workspaceOwnerId: user.workspaceOwnerId }, "Unable to persist appointment atomically");
    res.status(503).json({ error: "Não foi possível salvar a avaliação agora." });
  }
});

export default router;
