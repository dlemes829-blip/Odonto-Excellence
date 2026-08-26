import crypto from "node:crypto";
import { Router, type IRouter } from "express";

const router: IRouter = Router();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const DB_API_SECRET = process.env.DB_API_SECRET;
const ALLOWED_ORIGIN = "https://odonto-excellence-portal.onrender.com";
const DEVICE_EMOJIS = ["🦊","🐼","🦉","🐙","🦁","🐧","🐯","🐨","🦝","🐬","🦄","🐸","🐢","🦜","🐳","🦋","🐝","🦖","🐺","🐻"];

const writeBuckets = new Map<string, number[]>();
setInterval(() => {
  const cutoff = Date.now() - 15 * 60_000;
  for (const [key, values] of writeBuckets) {
    const recent = values.filter((value) => value > cutoff);
    if (recent.length) writeBuckets.set(key, recent);
    else writeBuckets.delete(key);
  }
}, 10 * 60_000).unref();

function requireConfig() {
  if (!SUPABASE_URL || !SUPABASE_KEY || !DB_API_SECRET) {
    throw new Error("management_control_not_configured");
  }
}

async function rpc(fn: string, operation: string, payload: Record<string, unknown> = {}) {
  requireConfig();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_secret: DB_API_SECRET,
      p_op: operation,
      p_payload: payload,
    }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`management_db_${response.status}:${raw.slice(0, 300)}`);
  return raw ? JSON.parse(raw) : null;
}

const db = (operation: string, payload: Record<string, unknown> = {}) => rpc("oe_acoes_rpc", operation, payload);
const presenceDb = (operation: string, payload: Record<string, unknown> = {}) => rpc("oe_acoes_presence", operation, payload);

function cleanText(value: unknown, max = 250) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.slice(0, max) : null;
}

function cleanMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
}

function phoneDigits(value: unknown) {
  const normalized = String(value ?? "").replace(/\D/g, "");
  if (!normalized) return null;
  return normalized.length > 11 ? normalized.slice(-11) : normalized;
}

function deviceId(req: any) {
  return cleanText(req.body?.device_id || req.query?.device_id, 80);
}

function deviceEmoji(id: string | null) {
  if (!id) return "👤";
  const seed = Number.parseInt(crypto.createHash("sha256").update(id).digest("hex").slice(0, 8), 16);
  return DEVICE_EMOJIS[seed % DEVICE_EMOJIS.length];
}

function actor(req: any) {
  const id = deviceId(req);
  return id ? `Dispositivo ${deviceEmoji(id)}` : "Dispositivo público";
}

function rateLimit(req: any, res: any, next: any) {
  const origin = req.headers.origin;
  if (origin && origin !== ALLOWED_ORIGIN) {
    res.status(403).json({ error: "Origem não autorizada." });
    return;
  }
  if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
    const key = req.ip || "unknown";
    const now = Date.now();
    const recent = (writeBuckets.get(key) || []).filter((value) => now - value < 15 * 60_000);
    if (recent.length >= 300) {
      res.status(429).json({ error: "Muitas alterações em pouco tempo." });
      return;
    }
    recent.push(now);
    writeBuckets.set(key, recent);
  }
  next();
}

router.use("/management", rateLimit);

router.get("/management/bootstrap", async (_req, res) => {
  try {
    res.json(await db("bootstrap"));
  } catch {
    res.status(503).json({ error: "Não foi possível carregar o Controle de Gestão." });
  }
});

router.get("/management/presence", async (_req, res) => {
  try {
    res.json(await presenceDb("list"));
  } catch {
    res.status(503).json({ error: "Presença temporariamente indisponível." });
  }
});

router.post("/management/presence", async (req, res) => {
  const id = deviceId(req);
  if (!id || !/^[A-Za-z0-9._:-]{12,80}$/.test(id)) {
    res.status(400).json({ error: "Dispositivo inválido." });
    return;
  }
  try {
    const avatar = deviceEmoji(id);
    const result = await presenceDb("heartbeat", {
      device_id: id,
      avatar_code: avatar,
      activity: cleanText(req.body?.activity, 40) || "online",
      entity_type: cleanText(req.body?.entity_type, 40),
      entity_id: cleanText(req.body?.entity_id, 120),
      activity_label: cleanText(req.body?.activity_label, 180),
    });
    res.json({ ...result, self: { device_id: id, avatar_code: avatar } });
  } catch {
    res.status(503).json({ error: "Presença temporariamente indisponível." });
  }
});

router.post("/management/actions", async (req, res) => {
  const date = cleanText(req.body?.date, 10);
  const location = cleanText(req.body?.location, 80) || "São Francisco";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
    res.status(400).json({ error: "Data inválida." });
    return;
  }
  const display = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  const name = cleanText(req.body?.name, 120) || `Ação ${location} ${display}`;
  try {
    res.status(201).json(await db("create_action", { date, location, name, campaign: "Ação de Rua", actor: actor(req) }));
  } catch {
    res.status(503).json({ error: "Não foi possível criar a ação." });
  }
});

router.post("/management/leads", async (req, res) => {
  const action_id = cleanText(req.body?.action_id, 100);
  const name = cleanText(req.body?.name, 120);
  if (!action_id || !name) {
    res.status(400).json({ error: "Ação e nome são obrigatórios." });
    return;
  }
  const phone_raw = cleanText(req.body?.phone_raw, 60);
  try {
    res.status(201).json(await db("create_lead", {
      action_id,
      name,
      phone_raw,
      phone_normalized: phoneDigits(phone_raw),
      captured_by: cleanText(req.body?.captured_by, 80),
      appointment_note: cleanText(req.body?.appointment_note, 600),
      status: cleanText(req.body?.status, 50) || "Novo",
      scheduled_by: cleanText(req.body?.scheduled_by, 80),
      outcome: cleanText(req.body?.outcome, 50),
      outcome_date: cleanText(req.body?.outcome_date, 10),
      value: cleanMoney(req.body?.value),
      actor: actor(req),
    }));
  } catch {
    res.status(503).json({ error: "Não foi possível adicionar o lead." });
  }
});

router.patch("/management/leads/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Lead inválido." });
    return;
  }
  const allowed = ["name", "phone_raw", "captured_by", "appointment_note", "status", "scheduled_by", "outcome", "outcome_date", "value", "action_id"];
  const payload: Record<string, unknown> = { id, actor: actor(req) };
  for (const key of allowed) if (Object.hasOwn(req.body || {}, key)) payload[key] = req.body[key];
  if (Object.keys(payload).length === 2) {
    res.status(400).json({ error: "Nenhuma alteração informada." });
    return;
  }
  if ("name" in payload) payload.name = cleanText(payload.name, 120);
  for (const [key, max] of [["phone_raw", 60], ["captured_by", 80], ["appointment_note", 600], ["status", 50], ["scheduled_by", 80], ["outcome", 50], ["outcome_date", 10], ["action_id", 100]] as const) {
    if (key in payload) payload[key] = cleanText(payload[key], max);
  }
  if ("value" in payload) payload.value = cleanMoney(payload.value);
  if ("phone_raw" in payload) payload.phone_normalized = phoneDigits(payload.phone_raw);
  try {
    res.json(await db("update_lead", payload));
  } catch {
    res.status(503).json({ error: "Não foi possível salvar o registro." });
  }
});

router.delete("/management/leads/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Lead inválido." });
    return;
  }
  try {
    res.json(await rpc("oe_acoes_delete_lead", "delete_lead", { id, actor: actor(req) }));
  } catch {
    res.status(503).json({ error: "Não foi possível excluir o registro." });
  }
});

router.get("/management/leads/:id/history", async (req, res) => {
  try {
    res.json(await db("lead_history", { id: Number(req.params.id) }));
  } catch {
    res.status(503).json({ error: "Não foi possível carregar o histórico." });
  }
});

router.post("/management/conversions", async (req, res) => {
  const name = cleanText(req.body?.name, 140);
  if (!name) {
    res.status(400).json({ error: "Nome do paciente é obrigatório." });
    return;
  }
  try {
    res.status(201).json(await db("create_conversion", {
      name,
      effective_date: cleanText(req.body?.effective_date, 10),
      value: cleanMoney(req.body?.value),
      tool: cleanText(req.body?.tool, 60),
      scheduled_by: cleanText(req.body?.scheduled_by, 80),
      converted_by: cleanText(req.body?.converted_by, 80),
      bonus: cleanMoney(req.body?.bonus),
      actor: actor(req),
    }));
  } catch {
    res.status(503).json({ error: "Não foi possível registrar a conversão." });
  }
});

router.patch("/management/conversions/:id", async (req, res) => {
  const id = Number(req.params.id);
  const payload: Record<string, unknown> = { id, actor: actor(req) };
  for (const key of ["name", "effective_date", "value", "tool", "scheduled_by", "converted_by", "bonus"]) {
    if (Object.hasOwn(req.body || {}, key)) payload[key] = req.body[key];
  }
  if ("name" in payload) payload.name = cleanText(payload.name, 140);
  if ("effective_date" in payload) payload.effective_date = cleanText(payload.effective_date, 10);
  if ("tool" in payload) payload.tool = cleanText(payload.tool, 60);
  if ("scheduled_by" in payload) payload.scheduled_by = cleanText(payload.scheduled_by, 80);
  if ("converted_by" in payload) payload.converted_by = cleanText(payload.converted_by, 80);
  if ("value" in payload) payload.value = cleanMoney(payload.value);
  if ("bonus" in payload) payload.bonus = cleanMoney(payload.bonus);
  try {
    res.json(await db("update_conversion", payload));
  } catch {
    res.status(503).json({ error: "Não foi possível salvar a conversão." });
  }
});

export default router;
