const MANAGEMENT_PREFIX = 'https://odonto-excellence-api.onrender.com/api/management';
const BOOTSTRAP_CACHE_KEY = 'controle-gestao-bootstrap-cache-v1';
const CACHE_MAX_AGE_MS = 6 * 60 * 60_000;
const CACHE_REFRESH_AFTER_MS = 1_500;

type Row = Record<string, unknown>;
type BootstrapData = {
  actions: Row[];
  leads: Row[];
  conversions: Row[];
  teamMembers?: unknown[];
  auditCount?: number;
};
type CachedBootstrap = { savedAt: number; data: BootstrapData };

let tempId = -Date.now();
let backgroundBootstrap: Promise<void> | null = null;
let refreshTimer = 0;
const pendingLeadCreates = new Map<number, Promise<Row>>();
const leadQueues = new Map<number, Promise<void>>();

function localDayKey(value: number) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function readCache(): CachedBootstrap | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(BOOTSTRAP_CACHE_KEY) || 'null') as CachedBootstrap | null;
    if (!parsed?.savedAt || !parsed.data) return null;
    const age = Date.now() - parsed.savedAt;
    if (age < 0 || age > CACHE_MAX_AGE_MS) return null;
    if (localDayKey(parsed.savedAt) !== localDayKey(Date.now())) return null;
    if (!Array.isArray(parsed.data.actions) || !Array.isArray(parsed.data.leads) || !Array.isArray(parsed.data.conversions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data: BootstrapData) {
  try {
    localStorage.setItem(BOOTSTRAP_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data } satisfies CachedBootstrap));
  } catch {
    // Cache is an acceleration layer only.
  }
}

function clearCache() {
  try { localStorage.removeItem(BOOTSTRAP_CACHE_KEY); } catch { /* no-op */ }
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function urlOf(input: RequestInfo | URL) {
  if (input instanceof Request) return input.url;
  return new URL(typeof input === 'string' ? input : input.toString(), window.location.href).toString();
}

function methodOf(input: RequestInfo | URL, init?: RequestInit) {
  return String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
}

function bodyObject(init?: RequestInit): Row {
  if (typeof init?.body !== 'string' || !init.body) return {};
  try { return JSON.parse(init.body) as Row; } catch { return {}; }
}

function cleanPayload(payload: Row) {
  const next = { ...payload };
  delete next.device_id;
  return next;
}

function leadIdFromUrl(url: string) {
  const match = new URL(url).pathname.match(/\/api\/management\/leads\/(-?\d+)$/);
  return match ? Number(match[1]) : null;
}

function conversionIdFromUrl(url: string) {
  const match = new URL(url).pathname.match(/\/api\/management\/conversions\/(-?\d+)$/);
  return match ? Number(match[1]) : null;
}

function cacheLead(id: number) {
  return readCache()?.data.leads.find((lead) => Number(lead.id) === id) || null;
}

function mergeCachedLead(id: number, patch: Row) {
  const cached = readCache();
  if (!cached) return;
  const leads = cached.data.leads.map((lead) => Number(lead.id) === id ? { ...lead, ...patch, id } : lead);
  writeCache({ ...cached.data, leads });
}

function addCachedLead(lead: Row) {
  const cached = readCache();
  if (!cached) return;
  writeCache({ ...cached.data, leads: [lead, ...cached.data.leads.filter((item) => Number(item.id) !== Number(lead.id))] });
}

function replaceCachedLead(fromId: number, lead: Row) {
  const cached = readCache();
  if (!cached) return;
  const exists = cached.data.leads.some((item) => Number(item.id) === fromId);
  const leads = exists
    ? cached.data.leads.map((item) => Number(item.id) === fromId ? lead : item)
    : [lead, ...cached.data.leads];
  writeCache({ ...cached.data, leads });
}

function removeCachedLead(id: number) {
  const cached = readCache();
  if (!cached) return;
  writeCache({ ...cached.data, leads: cached.data.leads.filter((item) => Number(item.id) !== id) });
}

function mergeCachedConversion(id: number, patch: Row) {
  const cached = readCache();
  if (!cached) return;
  const conversions = cached.data.conversions.map((row) => Number(row.id) === id ? { ...row, ...patch, id } : row);
  writeCache({ ...cached.data, conversions });
}

function addCachedConversion(row: Row) {
  const cached = readCache();
  if (!cached) return;
  writeCache({ ...cached.data, conversions: [row, ...cached.data.conversions.filter((item) => Number(item.id) !== Number(row.id))] });
}

function replaceCachedConversion(fromId: number, row: Row) {
  const cached = readCache();
  if (!cached) return;
  const exists = cached.data.conversions.some((item) => Number(item.id) === fromId);
  const conversions = exists
    ? cached.data.conversions.map((item) => Number(item.id) === fromId ? row : item)
    : [row, ...cached.data.conversions];
  writeCache({ ...cached.data, conversions });
}

function showSyncError(message = 'Não foi possível sincronizar a alteração. Os dados reais serão recarregados.') {
  document.querySelector('.cg-sync-error')?.remove();
  const toast = document.createElement('div');
  toast.className = 'cg-sync-error';
  toast.setAttribute('role', 'alert');
  toast.textContent = message;
  toast.style.cssText = 'position:fixed;left:14px;right:14px;bottom:86px;z-index:9999;max-width:560px;margin:auto;padding:12px 14px;border:1px solid #d8a0a0;border-radius:13px;background:#fff0f0;color:#752d2d;font:700 12px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 10px 30px rgba(60,20,20,.16)';
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 6_000);
}

function nudgeUiRefresh(attempt = 0) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    const button = document.querySelector<HTMLButtonElement>('.street-refresh, .mg-refresh');
    if (button && !button.disabled) {
      button.click();
      return;
    }
    if (attempt < 4) nudgeUiRefresh(attempt + 1);
  }, attempt ? 220 : 60);
}

async function responseError(response: Response) {
  try {
    const body = await response.clone().json() as { error?: string };
    return body.error || `Falha de sincronização (${response.status}).`;
  } catch {
    return `Falha de sincronização (${response.status}).`;
  }
}

async function patchWithRetry(baseFetch: typeof window.fetch, input: RequestInfo | URL, init?: RequestInit) {
  let lastError: unknown = null;
  for (const delay of [0, 700, 2_000]) {
    if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
    try {
      const response = await baseFetch(input, init);
      if (response.ok || (response.status >= 400 && response.status < 500)) return response;
      lastError = new Error(await responseError(response));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Falha ao sincronizar alteração.');
}

function enqueueLeadWrite(id: number, task: () => Promise<void>) {
  const previous = leadQueues.get(id) || Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(task)
    .catch((error) => {
      clearCache();
      showSyncError(error instanceof Error ? error.message : undefined);
      nudgeUiRefresh();
    })
    .finally(() => {
      if (leadQueues.get(id) === next) leadQueues.delete(id);
    });
  leadQueues.set(id, next);
}

export function installManagementPerformanceEnhancements() {
  const marker = window as typeof window & { __managementPerformanceEnhancements?: boolean };
  if (marker.__managementPerformanceEnhancements) return;
  marker.__managementPerformanceEnhancements = true;

  const baseFetch = window.fetch.bind(window);

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input);
    if (!url.startsWith(MANAGEMENT_PREFIX)) return baseFetch(input, init);

    const method = methodOf(input, init);
    const pathname = new URL(url).pathname;

    if (method === 'GET' && pathname === '/api/management/bootstrap') {
      const cached = readCache();
      if (cached) {
        if (Date.now() - cached.savedAt > CACHE_REFRESH_AFTER_MS && !backgroundBootstrap) {
          backgroundBootstrap = (async () => {
            try {
              const response = await baseFetch(input, { ...init, cache: 'no-store' });
              if (!response.ok) return;
              const fresh = await response.clone().json() as BootstrapData;
              writeCache(fresh);
              nudgeUiRefresh();
            } catch {
              // Keep the last known UI available while the free API wakes up.
            } finally {
              backgroundBootstrap = null;
            }
          })();
        }
        return jsonResponse(cached.data);
      }

      const response = await baseFetch(input, init);
      if (response.ok) {
        try { writeCache(await response.clone().json() as BootstrapData); } catch { /* no-op */ }
      }
      return response;
    }

    if (method === 'POST' && pathname === '/api/management/leads') {
      const payload = cleanPayload(bodyObject(init));
      const id = tempId--;
      const synthetic: Row = { id, ...payload, updated_at: new Date().toISOString() };
      addCachedLead(synthetic);

      const create = (async () => {
        const response = await baseFetch(input, init);
        if (!response.ok) throw new Error(await responseError(response));
        const real = await response.clone().json() as Row;
        replaceCachedLead(id, real);
        nudgeUiRefresh();
        return real;
      })();

      pendingLeadCreates.set(id, create);
      create.catch((error) => {
        removeCachedLead(id);
        showSyncError(error instanceof Error ? error.message : undefined);
        nudgeUiRefresh();
      }).finally(() => {
        window.setTimeout(() => pendingLeadCreates.delete(id), 60_000);
      });

      return jsonResponse(synthetic, 201);
    }

    if (method === 'PATCH') {
      const id = leadIdFromUrl(url);
      if (id !== null) {
        const payload = cleanPayload(bodyObject(init));
        const current = cacheLead(id) || { id };
        const synthetic = { ...current, ...payload, id, updated_at: new Date().toISOString() };
        mergeCachedLead(id, synthetic);

        enqueueLeadWrite(id, async () => {
          let targetId = id;
          let targetUrl = url;
          if (id < 0) {
            const pending = pendingLeadCreates.get(id);
            if (!pending) throw new Error('O novo registro ainda não foi confirmado pelo servidor.');
            const real = await pending;
            targetId = Number(real.id);
            targetUrl = url.replace(/\/leads\/-?\d+$/, `/leads/${targetId}`);
          }
          const response = await patchWithRetry(baseFetch, targetUrl, init);
          if (!response.ok) throw new Error(await responseError(response));
          const realUpdated = await response.clone().json() as Row;
          if (id < 0) replaceCachedLead(id, realUpdated);
          else replaceCachedLead(targetId, realUpdated);
          nudgeUiRefresh();
        });

        return jsonResponse(synthetic);
      }

      const conversionId = conversionIdFromUrl(url);
      if (conversionId !== null) {
        const payload = cleanPayload(bodyObject(init));
        const cached = readCache();
        const current = cached?.data.conversions.find((row) => Number(row.id) === conversionId) || { id: conversionId };
        const synthetic = { ...current, ...payload, id: conversionId, updated_at: new Date().toISOString() };
        mergeCachedConversion(conversionId, synthetic);

        void patchWithRetry(baseFetch, input, init).then(async (response) => {
          if (!response.ok) throw new Error(await responseError(response));
          replaceCachedConversion(conversionId, await response.clone().json() as Row);
          nudgeUiRefresh();
        }).catch((error) => {
          clearCache();
          showSyncError(error instanceof Error ? error.message : undefined);
          nudgeUiRefresh();
        });

        return jsonResponse(synthetic);
      }
    }

    if (method === 'POST' && pathname === '/api/management/conversions') {
      const payload = cleanPayload(bodyObject(init));
      const id = tempId--;
      const synthetic: Row = { id, ...payload, updated_at: new Date().toISOString() };
      addCachedConversion(synthetic);

      void baseFetch(input, init).then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        replaceCachedConversion(id, await response.clone().json() as Row);
        nudgeUiRefresh();
      }).catch((error) => {
        clearCache();
        showSyncError(error instanceof Error ? error.message : undefined);
        nudgeUiRefresh();
      });

      return jsonResponse(synthetic, 201);
    }

    const response = await baseFetch(input, init);
    if (response.ok && method !== 'GET' && pathname !== '/api/management/presence') clearCache();
    return response;
  }) as typeof window.fetch;
}
