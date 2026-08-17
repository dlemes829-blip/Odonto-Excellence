import { db, odontoPortalStates, odontoPortalUserStates } from "@workspace/db";
import { like } from "drizzle-orm";
import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import { requirePortalUser, type PortalRequest } from "../lib/odontoPortalAuth";

const router: IRouter = Router();
const TRAINING_METADATA_PREFIX = "training-metadata:";
const TRAINING_TARGET = 218;
const KYRON_MESSAGE_LIMIT = 3_900;
const KYRON_CONTEXT_BUDGET = 2_350;
const CORPUS_CACHE_MS = 20_000;
const AGENT_WINDOW_MS = 5 * 60_000;
const AGENT_MAX_REQUESTS = 30;
const KYRON_CONVERSATION_URL = (
  process.env.KYRON_AGENT_CONVERSATION_URL ??
  "https://kyronagent.com.br/api/public/conversation"
).trim();

type HistoryItem = { role: "user" | "assistant"; content: string };
type TrainingRecord = { id?: string; title?: string; area?: string; durationMinutes?: number };
type MetadataItem = { title?: string; durationMinutes?: number; notes?: string };
type CorpusItem = { workspaceOwnerId: string; record: TrainingRecord; meta?: MetadataItem; ordinal: number };
type CorpusCache = { expiresAt: number; items: CorpusItem[]; counts: Map<string, number> };

let corpusCache: CorpusCache | null = null;
const requestWindows = new Map<string, { count: number; resetAt: number }>();

function cleanText(value: unknown, max = 2_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function redactSensitiveText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[e-mail protegido]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF protegido]")
    .replace(/\b(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}\b/g, "[telefone protegido]")
    .replace(/\b\d{8,}\b/g, "[identificador protegido]")
    .replace(/\b(cpf|rg|telefone|celular|e-?mail)\s*[:=\-]\s*[^\s|,;]+/gi, "$1: [dado protegido]");
}

function tokens(value: string) {
  return Array.from(new Set(value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter((part) => part.length >= 3)));
}

function scoreRecord(record: TrainingRecord, metadata: MetadataItem | undefined, queryTokens: string[]) {
  const haystack = `${record.title ?? ""} ${record.area ?? ""} ${metadata?.title ?? ""} ${metadata?.notes ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return queryTokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

function agentRateLimit(req: Request, res: Response, next: NextFunction) {
  const principal = (req as PortalRequest).portalUser;
  const key = principal?.id || req.ip || "unknown";
  const now = Date.now();
  const current = requestWindows.get(key);
  if (current && current.resetAt > now && current.count >= AGENT_MAX_REQUESTS) {
    res.status(429).json({ error: "Muitas consultas ao agente. Aguarde alguns minutos." });
    return;
  }
  requestWindows.set(key, current && current.resetAt > now ? { ...current, count: current.count + 1 } : { count: 1, resetAt: now + AGENT_WINDOW_MS });
  if (requestWindows.size > 1_000) {
    for (const [id, entry] of requestWindows) if (entry.resetAt <= now) requestWindows.delete(id);
  }
  next();
}

function metadataMap(rows: Array<{ portalKey: string; state: unknown }>) {
  const map = new Map<string, Record<string, MetadataItem>>();
  for (const row of rows) {
    if (!row.portalKey.startsWith(TRAINING_METADATA_PREFIX)) continue;
    const workspaceOwnerId = row.portalKey.slice(TRAINING_METADATA_PREFIX.length);
    const state = (row.state ?? {}) as { videos?: unknown };
    const videos = state.videos && typeof state.videos === "object" && !Array.isArray(state.videos)
      ? (state.videos as Record<string, MetadataItem>)
      : {};
    map.set(workspaceOwnerId, videos);
  }
  return map;
}

async function loadCorpus() {
  const now = Date.now();
  if (corpusCache && corpusCache.expiresAt > now) return corpusCache;

  const [stateRows, metadataRows] = await Promise.all([
    db.select({ userId: odontoPortalUserStates.userId, state: odontoPortalUserStates.state }).from(odontoPortalUserStates),
    db.select({ portalKey: odontoPortalStates.portalKey, state: odontoPortalStates.state })
      .from(odontoPortalStates)
      .where(like(odontoPortalStates.portalKey, `${TRAINING_METADATA_PREFIX}%`)),
  ]);

  const metadataByWorkspace = metadataMap(metadataRows);
  const items: CorpusItem[] = [];
  const counts = new Map<string, number>();
  let ordinal = 0;
  for (const row of stateRows) {
    const state = (row.state ?? {}) as { training?: unknown };
    if (!Array.isArray(state.training)) continue;
    const records = (state.training as TrainingRecord[]).filter((item) => cleanText(item?.title, 120));
    counts.set(row.userId, records.length);
    const metadata = metadataByWorkspace.get(row.userId) ?? {};
    for (const record of records) {
      ordinal += 1;
      items.push({ workspaceOwnerId: row.userId, record, meta: record.id ? metadata[record.id] : undefined, ordinal });
    }
  }
  corpusCache = { expiresAt: now + CORPUS_CACHE_MS, items, counts };
  return corpusCache;
}

function buildContext(items: CorpusItem[], queryTokens: string[]) {
  const ranked = items
    .map((item) => ({ ...item, score: scoreRecord(item.record, item.meta, queryTokens) }))
    .sort((a, b) => b.score - a.score || b.ordinal - a.ordinal);

  const lines: string[] = [];
  let used = 0;
  for (const item of ranked) {
    if (lines.length >= 36) break;
    const title = redactSensitiveText(cleanText(item.meta?.title || item.record.title, 150));
    if (!title) continue;
    const notes = redactSensitiveText(cleanText(item.meta?.notes, 520));
    const area = redactSensitiveText(cleanText(item.record.area, 70));
    const line = [title, area ? `Tema: ${area}` : "", notes ? `Observações: ${notes}` : ""].filter(Boolean).join(" | ");
    if (used + line.length > KYRON_CONTEXT_BUDGET) continue;
    lines.push(`${lines.length + 1}. ${line}`);
    used += line.length + 4;
  }
  return lines.join("\n");
}

router.post("/odonto-portal/training-agent", agentRateLimit, async (req, res) => {
  const user = requirePortalUser(req as PortalRequest, res);
  if (!user) return;

  const message = cleanText(req.body?.message, 2_000);
  if (!message) {
    res.status(400).json({ error: "Escreva uma pergunta para o Kyron Agent." });
    return;
  }

  const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];
  const history: HistoryItem[] = rawHistory.slice(-6).flatMap((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const source = item as { role?: unknown; content?: unknown };
    if (source.role !== "user" && source.role !== "assistant") return [];
    const content = redactSensitiveText(cleanText(source.content, 1_200));
    return content ? [{ role: source.role, content }] : [];
  });

  try {
    const corpus = await loadCorpus();
    const ownRecords = corpus.counts.get(user.workspaceOwnerId) ?? 0;
    const context = buildContext(corpus.items, tokens(message));
    const safeMessage = redactSensitiveText(message);
    const scopedMessage = [
      "Você é o Kyron Agent dentro do Treinamento Gerente Odonto Excellence.",
      "Converse naturalmente em português e responda de forma profissional.",
      "Use a base compartilhada de treinamento, mas nunca revele identidade, origem da conta ou dado pessoal de quem cadastrou um conteúdo.",
      "Dados pessoais e identificadores são removidos antes do envio. Não tente reconstruí-los ou inferi-los.",
      "Faça cálculos, porcentagens, médias, projeções e regra de três quando solicitado, mostrando a conta de forma curta quando útil.",
      "Para regras específicas da operação, priorize o conteúdo registrado. Se a base não sustentar uma afirmação, diga isso claramente.",
      `PROGRESSO DO USUÁRIO ATUAL: ${ownRecords} vídeos registrados de ${TRAINING_TARGET}.`,
      `BASE COMPARTILHADA: ${corpus.items.length} registros de vídeo disponíveis para consulta.`,
      context ? `CONTEÚDO MAIS RELEVANTE:\n${context}` : "CONTEÚDO RELEVANTE: nenhum registro encontrado.",
      `PERGUNTA DO USUÁRIO:\n${safeMessage}`,
    ].join("\n\n").slice(0, KYRON_MESSAGE_LIMIT);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18_000);
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
      logger.warn({ status: response.status }, "Kyron training agent unavailable");
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
