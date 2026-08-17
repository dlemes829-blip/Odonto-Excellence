import { db, odontoPortalStates, odontoPortalUserStates } from "@workspace/db";
import { like } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { requirePortalUser, type PortalRequest } from "../lib/odontoPortalAuth";

const router: IRouter = Router();
const TRAINING_METADATA_PREFIX = "training-metadata:";
const TRAINING_TARGET = 218;
const KYRON_MESSAGE_LIMIT = 3_900;
const KYRON_CONTEXT_BUDGET = 2_350;
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
type CorpusItem = {
  workspaceOwnerId: string;
  record: TrainingRecord;
  meta?: MetadataItem;
  ordinal: number;
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

function metadataMap(rows: Array<{ portalKey: string; state: unknown }>) {
  const map = new Map<string, Record<string, MetadataItem>>();
  for (const row of rows) {
    if (!row.portalKey.startsWith(TRAINING_METADATA_PREFIX)) continue;
    const workspaceOwnerId = row.portalKey.slice(TRAINING_METADATA_PREFIX.length);
    const state = (row.state ?? {}) as { videos?: unknown };
    const videos =
      state.videos && typeof state.videos === "object" && !Array.isArray(state.videos)
        ? (state.videos as Record<string, MetadataItem>)
        : {};
    map.set(workspaceOwnerId, videos);
  }
  return map;
}

function buildContext(items: CorpusItem[], queryTokens: string[]) {
  const ranked = items
    .map((item) => ({
      ...item,
      score: scoreRecord(item.record, item.meta, queryTokens),
    }))
    .sort((a, b) => b.score - a.score || b.ordinal - a.ordinal);

  const lines: string[] = [];
  let used = 0;
  for (const item of ranked) {
    if (lines.length >= 36) break;
    const title = cleanText(item.meta?.title || item.record.title, 150);
    if (!title) continue;
    const notes = cleanText(item.meta?.notes, 520);
    const area = cleanText(item.record.area, 70);
    const line = [title, area ? `Tema: ${area}` : "", notes ? `Observações: ${notes}` : ""]
      .filter(Boolean)
      .join(" | ");
    if (used + line.length > KYRON_CONTEXT_BUDGET) continue;
    lines.push(`${lines.length + 1}. ${line}`);
    used += line.length + 4;
  }
  return lines.join("\n");
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
    res.status(400).json({ error: "Escreva uma pergunta para o Kyron Agent." });
    return;
  }

  try {
    // The learning corpus is intentionally shared across portal users. Only
    // training titles, areas and notes are extracted; user identities, agenda,
    // financial records, passwords and administrative data are never included.
    const [stateRows, metadataRows] = await Promise.all([
      db
        .select({ userId: odontoPortalUserStates.userId, state: odontoPortalUserStates.state })
        .from(odontoPortalUserStates),
      db
        .select({ portalKey: odontoPortalStates.portalKey, state: odontoPortalStates.state })
        .from(odontoPortalStates)
        .where(like(odontoPortalStates.portalKey, `${TRAINING_METADATA_PREFIX}%`)),
    ]);

    const metadataByWorkspace = metadataMap(metadataRows);
    const corpus: CorpusItem[] = [];
    let ordinal = 0;
    let ownRecords = 0;

    for (const row of stateRows) {
      const state = (row.state ?? {}) as { training?: unknown };
      if (!Array.isArray(state.training)) continue;
      const records = (state.training as TrainingRecord[]).filter((item) => cleanText(item?.title, 120));
      if (row.userId === user.workspaceOwnerId) ownRecords = records.length;
      const metadata = metadataByWorkspace.get(row.userId) ?? {};
      for (const record of records) {
        ordinal += 1;
        corpus.push({
          workspaceOwnerId: row.userId,
          record,
          meta: record.id ? metadata[record.id] : undefined,
          ordinal,
        });
      }
    }

    const queryTokens = tokens(message);
    const context = buildContext(corpus, queryTokens);
    const instructions = [
      "Você é o Kyron Agent dentro do Treinamento Gerente Odonto Excellence.",
      "Converse naturalmente em português, entenda perguntas de acompanhamento e explique como um assistente inteligente de gestão.",
      "Use a base compartilhada de treinamentos de todos os usuários do portal para responder. A base contém somente títulos, temas e observações de vídeos, sem identidade de quem cadastrou.",
      "Você também pode fazer cálculos, porcentagens, médias, projeções, regra de três e comparações usando números fornecidos pelo usuário ou encontrados nos treinamentos. Mostre a conta de forma curta quando isso ajudar.",
      "Para regras específicas da operação, priorize o conteúdo registrado. Se a base não sustentar uma afirmação específica, diga isso claramente em vez de inventar.",
      `PROGRESSO DO USUÁRIO ATUAL: ${ownRecords} vídeos registrados de ${TRAINING_TARGET}.`,
      `BASE COMPARTILHADA: ${corpus.length} registros de vídeo disponíveis para consulta.`,
      context ? `CONTEÚDO MAIS RELEVANTE PARA ESTA PERGUNTA:\n${context}` : "CONTEÚDO RELEVANTE: nenhum registro encontrado.",
      `PERGUNTA DO USUÁRIO:\n${message}`,
    ];
    const scopedMessage = instructions.join("\n\n").slice(0, KYRON_MESSAGE_LIMIT);

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
