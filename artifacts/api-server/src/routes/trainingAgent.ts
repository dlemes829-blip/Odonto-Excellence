import { db, odontoPortalStates, odontoPortalUserStates } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { requirePortalUser, type PortalRequest } from "../lib/odontoPortalAuth";

const router: IRouter = Router();
const TRAINING_METADATA_PREFIX = "training-metadata:";
const KYRON_CONVERSATION_URL = (
  process.env.KYRON_AGENT_CONVERSATION_URL ??
  "https://kyronagent.com.br/api/public/conversation"
).trim();

type HistoryItem = { role: "user" | "assistant"; content: string };
type TrainingRecord = {
  id?: string;
  title?: string;
  area?: string;
  durationMinutes?: number;
};
type MetadataItem = {
  title?: string;
  durationMinutes?: number;
  notes?: string;
};

function cleanText(value: unknown, max = 2_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function tokens(value: string) {
  return Array.from(
    new Set(
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((part) => part.length >= 3),
    ),
  );
}

function scoreRecord(record: TrainingRecord, metadata: MetadataItem | undefined, queryTokens: string[]) {
  const haystack = `${record.title ?? ""} ${record.area ?? ""} ${metadata?.title ?? ""} ${metadata?.notes ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return queryTokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

router.post("/odonto-portal/training-agent", async (req, res) => {
  const user = requirePortalUser(req as PortalRequest, res);
  if (!user) return;

  const message = cleanText(req.body?.message, 2_000);
  const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];
  const history: HistoryItem[] = rawHistory
    .slice(-6)
    .flatMap((item: unknown) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const source = item as { role?: unknown; content?: unknown };
      if (source.role !== "user" && source.role !== "assistant") return [];
      const content = cleanText(source.content, 2_000);
      return content ? [{ role: source.role, content }] : [];
    });

  if (!message) {
    res.status(400).json({ error: "Escreva uma pergunta sobre os treinamentos." });
    return;
  }

  try {
    const [[stateRow], [metadataRow]] = await Promise.all([
      db
        .select({ state: odontoPortalUserStates.state })
        .from(odontoPortalUserStates)
        .where(eq(odontoPortalUserStates.userId, user.workspaceOwnerId))
        .limit(1),
      db
        .select({ state: odontoPortalStates.state })
        .from(odontoPortalStates)
        .where(eq(odontoPortalStates.portalKey, `${TRAINING_METADATA_PREFIX}${user.workspaceOwnerId}`))
        .limit(1),
    ]);

    const state = (stateRow?.state ?? {}) as { training?: unknown };
    const records = Array.isArray(state.training)
      ? (state.training as TrainingRecord[]).filter((item) => cleanText(item?.title, 120))
      : [];
    const metadataState = (metadataRow?.state ?? {}) as { videos?: unknown };
    const metadata =
      metadataState.videos && typeof metadataState.videos === "object" && !Array.isArray(metadataState.videos)
        ? (metadataState.videos as Record<string, MetadataItem>)
        : {};

    const queryTokens = tokens(message);
    const selected = records
      .map((record, index) => ({
        record,
        index,
        meta: record.id ? metadata[record.id] : undefined,
        score: scoreRecord(record, record.id ? metadata[record.id] : undefined, queryTokens),
      }))
      .sort((a, b) => b.score - a.score || b.index - a.index)
      .slice(0, 28);

    const context = selected
      .map(({ record, meta }, index) => {
        const notes = cleanText(meta?.notes, 1_200);
        return [
          `${index + 1}. ${cleanText(meta?.title || record.title, 160)}`,
          record.area ? `Tema: ${cleanText(record.area, 80)}` : "",
          notes ? `Observações: ${notes}` : "",
        ]
          .filter(Boolean)
          .join(" | ");
      })
      .join("\n");

    const scopedMessage = [
      "Você é o Kyron Agent dentro do Treinamento Gerente Odonto Excellence.",
      "Responda de forma didática, objetiva e profissional usando prioritariamente o conteúdo dos vídeos e observações abaixo.",
      "Se o conteúdo disponível não sustentar uma resposta específica, diga claramente que essa informação não consta nos treinamentos registrados. Não invente regras clínicas, jurídicas ou financeiras.",
      `PROGRESSO: ${records.length} vídeos registrados de uma meta total de 218.`,
      context ? `CONTEÚDO DE TREINAMENTO RELEVANTE:\n${context}` : "CONTEÚDO DE TREINAMENTO RELEVANTE: nenhum registro disponível.",
      `PERGUNTA DO USUÁRIO:\n${message}`,
    ].join("\n\n");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    let response: Response;
    try {
      response = await fetch(KYRON_CONVERSATION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: scopedMessage, history }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const body = (await response.json().catch(() => ({}))) as { content?: unknown; error?: unknown };
    if (!response.ok || typeof body.content !== "string" || !body.content.trim()) {
      logger.warn({ status: response.status, error: body.error }, "Kyron training agent unavailable");
      res.status(503).json({ error: "O Kyron Agent está indisponível neste momento." });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({ content: body.content.trim().slice(0, 8_000) });
  } catch (error) {
    logger.error({ err: error }, "Unable to answer training-agent question");
    res.status(503).json({ error: "Não foi possível consultar o Kyron Agent agora." });
  }
});

export default router;
