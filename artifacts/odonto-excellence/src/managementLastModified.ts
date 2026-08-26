import './managementLastModified.css';

const API = 'https://odonto-excellence-api.onrender.com/api/management';
const REFRESH_MS = 12_000;

type LastModifiedResponse = {
  date: string;
  last_modified?: string | null;
  actor?: string | null;
  event?: string | null;
  entity_type?: string | null;
  source?: string | null;
};

let installed = false;
let currentDate = '';
let lastFetchAt = 0;
let inFlight: Promise<void> | null = null;
let intervalId = 0;
let observer: MutationObserver | null = null;
let deferredId = 0;

function selectedDate() {
  const raw = document.querySelector('.mg-day-heading .mg-eyebrow')?.textContent?.trim() || '';
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || '';
  return `${part('day')}/${part('month')}/${part('year')} às ${part('hour')}:${part('minute')}`;
}

function eventLabel(event?: string | null, entityType?: string | null) {
  if (event === 'delete') return 'exclusão de registro';
  if (event === 'import_update' || event === 'import_create') return 'importação de planilha';
  if (event === 'update') return entityType === 'conversion' ? 'edição de conversão' : 'edição de registro';
  if (event === 'create') return entityType === 'conversion' ? 'nova conversão' : 'novo registro';
  if (event === 'import_create') return 'importação de planilha';
  if (event === 'action_archived') return 'alteração do dia';
  return 'alteração registrada';
}

function iconSvg() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v4l2.5 1.5"/><circle cx="12" cy="12" r="9"/></svg>';
}

function ensureIndicator() {
  if (window.matchMedia('(max-width: 760px)').matches) return null;
  const heading = document.querySelector<HTMLElement>('.mg-day-heading > div:first-child');
  if (!heading) return null;
  let indicator = heading.querySelector<HTMLElement>('.mg-last-modified');
  if (indicator) return indicator;
  indicator = document.createElement('div');
  indicator.className = 'mg-last-modified is-loading';
  indicator.setAttribute('aria-live', 'polite');
  indicator.innerHTML = `${iconSvg()}<span><b>Última modificação deste dia:</b> consultando...</span>`;
  heading.append(indicator);
  return indicator;
}

function render(result: LastModifiedResponse) {
  const indicator = ensureIndicator();
  if (!indicator) return;
  indicator.classList.remove('is-loading');
  if (!result.last_modified) {
    indicator.innerHTML = `${iconSvg()}<span><b>Última modificação deste dia:</b> sem alterações registradas</span>`;
    indicator.removeAttribute('title');
    return;
  }
  const label = formatTimestamp(result.last_modified);
  indicator.innerHTML = `${iconSvg()}<span class="mg-last-modified-dot"></span><span><b>Última modificação deste dia:</b> <time>${label}</time></span>`;
  const details = [eventLabel(result.event, result.entity_type), result.actor].filter(Boolean).join(' · ');
  if (details) indicator.title = details;
}

async function refresh(force = false) {
  const date = selectedDate();
  const indicator = ensureIndicator();
  if (!date || !indicator) return;
  const changedDay = date !== currentDate;
  if (!force && !changedDay && Date.now() - lastFetchAt < REFRESH_MS) return;
  if (inFlight) return inFlight;

  currentDate = date;
  lastFetchAt = Date.now();
  indicator.classList.add('is-loading');
  if (changedDay) indicator.innerHTML = `${iconSvg()}<span><b>Última modificação deste dia:</b> consultando...</span>`;

  inFlight = (async () => {
    try {
      const response = await fetch(`${API}/last-modified?date=${encodeURIComponent(date)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('last_modified_unavailable');
      const result = await response.json() as LastModifiedResponse;
      if (selectedDate() === date) render(result);
    } catch {
      indicator.classList.remove('is-loading');
      indicator.innerHTML = `${iconSvg()}<span><b>Última modificação deste dia:</b> indisponível no momento</span>`;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

function deferRefresh(delay = 900) {
  window.clearTimeout(deferredId);
  deferredId = window.setTimeout(() => void refresh(true), delay);
}

export function installManagementLastModified() {
  if (installed) return;
  installed = true;

  ensureIndicator();
  void refresh(true);

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('.mg-day-strip button, .mg-refresh')) deferRefresh(120);
    if (event.target.closest('.mg-modal button, .mg-row-actions button, .mg-import-confirm')) deferRefresh(1_800);
  }, true);

  document.addEventListener('change', (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('.mg-status')) deferRefresh(1_800);
  }, true);

  observer = new MutationObserver(() => {
    ensureIndicator();
    const date = selectedDate();
    if (date && date !== currentDate) void refresh(true);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  intervalId = window.setInterval(() => void refresh(), REFRESH_MS);
  window.addEventListener('beforeunload', () => {
    window.clearInterval(intervalId);
    observer?.disconnect();
  }, { once: true });
}
