import { Router, type IRouter } from "express";

const router: IRouter = Router();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const DB_API_SECRET = process.env.DB_API_SECRET;
const ALLOWED_ORIGIN = "https://odonto-excellence-portal.onrender.com";
const MAX_ROWS = 2500;

function cleanText(value: unknown, max: number) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

function cleanDate(value: unknown) {
  const text = cleanText(value, 10);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function cleanMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

function cleanInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function cleanSourceKey(value: unknown, prefix: "xlsx-row" | "xlsx-conversion-row") {
  const text = cleanText(value, 80);
  return text && new RegExp(`^${prefix}-\\d+$`).test(text) ? text : null;
}

function cleanPhone(value: unknown) {
  const raw = cleanText(value, 60);
  if (!raw) return { raw: null, normalized: null };
  let normalized = raw.replace(/\D/g, "");
  if (normalized.length > 11) normalized = normalized.slice(-11);
  return { raw, normalized: normalized || null };
}

function sanitizeLead(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const actionDate = cleanDate(row.action_date);
  const name = cleanText(row.name, 120);
  if (!actionDate || !name) return null;
  const phone = cleanPhone(row.phone_raw ?? row.phone_normalized);
  return {
    source_key: cleanSourceKey(row.source_key, "xlsx-row"),
    action_date: actionDate,
    action_name: cleanText(row.action_name, 120),
    location: cleanText(row.location, 80) || "São Francisco",
    campaign: cleanText(row.campaign, 80) || "Ação de Rua",
    sheet_number: cleanInteger(row.sheet_number),
    name,
    phone_raw: phone.raw,
    phone_normalized: phone.normalized,
    captured_by: cleanText(row.captured_by, 80),
    appointment_note: cleanText(row.appointment_note, 600),
    status: cleanText(row.status, 50) || "Novo",
    status_raw: cleanText(row.status_raw, 80),
    scheduled_by: cleanText(row.scheduled_by, 80),
    outcome: cleanText(row.outcome, 50),
    outcome_date: cleanDate(row.outcome_date),
    value: cleanMoney(row.value),
  };
}

function sanitizeConversion(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const name = cleanText(row.name, 140);
  if (!name) return null;
  return {
    source_key: cleanSourceKey(row.source_key, "xlsx-conversion-row"),
    name,
    effective_date: cleanDate(row.effective_date),
    value: cleanMoney(row.value),
    tool: cleanText(row.tool, 60),
    scheduled_by: cleanText(row.scheduled_by, 80),
    converted_by: cleanText(row.converted_by, 80),
    bonus: cleanMoney(row.bonus),
  };
}

async function importRpc(payload: Record<string, unknown>) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !DB_API_SECRET) {
    throw new Error("management_import_not_configured");
  }
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/oe_acoes_import_sheet`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_secret: DB_API_SECRET, p_op: "import", p_payload: payload }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`management_import_${response.status}:${raw.slice(0, 300)}`);
  return raw ? JSON.parse(raw) : null;
}

router.post("/management/import", async (req, res) => {
  const origin = req.headers.origin;
  if (origin && origin !== ALLOWED_ORIGIN) {
    res.status(403).json({ error: "Origem não autorizada." });
    return;
  }

  const rawLeads = Array.isArray(req.body?.leads) ? req.body.leads : [];
  const rawConversions = Array.isArray(req.body?.conversions) ? req.body.conversions : [];
  if (rawLeads.length + rawConversions.length > MAX_ROWS) {
    res.status(413).json({ error: `A planilha excede o limite seguro de ${MAX_ROWS} registros.` });
    return;
  }

  const leads = rawLeads.map(sanitizeLead).filter(Boolean);
  const conversions = rawConversions.map(sanitizeConversion).filter(Boolean);
  if (!leads.length && !conversions.length) {
    res.status(400).json({ error: "Nenhum registro válido foi identificado na planilha." });
    return;
  }

  const device = cleanText(req.body?.device_id, 80);
  const actor = device ? `Importação · ${device.slice(0, 36)}` : "Importação da planilha";
  try {
    const result = await importRpc({ leads, conversions, actor });
    res.json({ ...result, received: { leads: leads.length, conversions: conversions.length } });
  } catch {
    res.status(503).json({ error: "Não foi possível importar a planilha. Nenhuma importação deve ser considerada concluída." });
  }
});

export default router;
