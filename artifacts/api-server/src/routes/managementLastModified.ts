import { Router, type IRouter } from "express";

const router: IRouter = Router();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const DB_API_SECRET = process.env.DB_API_SECRET;

async function lastModified(date: string) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !DB_API_SECRET) {
    throw new Error("management_last_modified_not_configured");
  }
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/oe_acoes_day_last_modified`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_secret: DB_API_SECRET, p_date: date }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`management_last_modified_${response.status}:${raw.slice(0, 250)}`);
  return raw ? JSON.parse(raw) : null;
}

router.get("/management/last-modified", async (req, res) => {
  const date = String(req.query.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "Data inválida." });
    return;
  }
  try {
    res.json(await lastModified(date));
  } catch {
    res.status(503).json({ error: "Não foi possível consultar a última modificação." });
  }
});

export default router;
