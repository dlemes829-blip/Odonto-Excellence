import crypto from "node:crypto";
import { Router, type IRouter } from "express";

const router: IRouter = Router();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const DB_API_SECRET = process.env.DB_API_SECRET;
const ALLOWED_ORIGIN = "https://odonto-excellence-portal.onrender.com";
const DEVICE_EMOJIS = ["🦊","🐼","🦉","🐙","🦁","🐧","🐯","🐨","🦝","🐬","🦄","🐸","🐢","🦜","🐳","🦋","🐝","🦖","🐺","🐻"];

function configured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY && DB_API_SECRET);
}

function cleanText(value: unknown, max = 250) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.slice(0, max) : null;
}

function deviceEmoji(id: string | null) {
  if (!id) return "👤";
  const seed = Number.parseInt(crypto.createHash("sha256").update(id).digest("hex").slice(0, 8), 16);
  return DEVICE_EMOJIS[seed % DEVICE_EMOJIS.length];
}

function actor(req: any) {
  const id = cleanText(req.body?.device_id || req.query?.device_id, 80);
  return id ? `Dispositivo ${deviceEmoji(id)}` : "Dispositivo público";
}

async function callRpc(fn: string, operation: string, payload: Record<string, unknown> = {}) {
  if (!configured()) throw new Error("management_control_not_configured");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_secret: DB_API_SECRET, p_op: operation, p_payload: payload }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`management_db_${response.status}:${raw.slice(0, 300)}`);
  return raw ? JSON.parse(raw) : null;
}

const db = (operation: string, payload: Record<string, unknown> = {}) => callRpc("oe_acoes_rpc", operation, payload);
const archiveDb = (operation: string, payload: Record<string, unknown> = {}) => callRpc("oe_acoes_day_archive", operation, payload);

function validDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function originAllowed(req: any) {
  const origin = req.headers.origin;
  return !origin || origin === ALLOWED_ORIGIN;
}

router.get("/management/bootstrap", async (req, res, next) => {
  if (!originAllowed(req)) {
    res.status(403).json({ error: "Origem não autorizada." });
    return;
  }
  try {
    const [data, archived] = await Promise.all([db("bootstrap"), archiveDb("list")]);
    const hidden = new Set<string>(Array.isArray(archived?.dates) ? archived.dates : []);
    if (!hidden.size) {
      res.json(data);
      return;
    }
    const actions = Array.isArray(data?.actions)
      ? data.actions.filter((item: any) => !hidden.has(String(item?.date || "")))
      : [];
    const visibleActionIds = new Set(actions.map((item: any) => String(item?.id || "")));
    const leads = Array.isArray(data?.leads)
      ? data.leads.filter((item: any) => visibleActionIds.has(String(item?.action_id || "")))
      : [];
    res.json({ ...data, actions, leads });
  } catch {
    next();
  }
});

router.post("/management/actions", async (req, res, next) => {
  if (!originAllowed(req)) {
    res.status(403).json({ error: "Origem não autorizada." });
    return;
  }
  const date = cleanText(req.body?.date, 10);
  if (!validDate(date)) {
    next();
    return;
  }
  try {
    await archiveDb("restore", { date, actor: actor(req) });
  } catch {
    // A date that was never archived is already in the desired state.
  }
  next();
});

router.delete("/management/days/:date", async (req, res) => {
  if (!originAllowed(req)) {
    res.status(403).json({ error: "Origem não autorizada." });
    return;
  }
  const date = cleanText(req.params.date, 10);
  const confirmation = cleanText(req.body?.confirmation, 20);
  if (!validDate(date)) {
    res.status(400).json({ error: "Data inválida." });
    return;
  }
  if (confirmation !== date) {
    res.status(400).json({ error: "Confirme a data exata antes de excluir o dia." });
    return;
  }
  try {
    const result = await archiveDb("archive", { date, actor: actor(req) });
    res.json({ ...result, archived: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("day_not_found")) {
      res.status(404).json({ error: "Dia de ação não encontrado." });
      return;
    }
    res.status(503).json({ error: "Não foi possível excluir o dia de ação." });
  }
});

export default router;
