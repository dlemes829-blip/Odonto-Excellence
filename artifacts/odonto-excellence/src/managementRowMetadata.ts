import './managementRowMetadata.css';

const API = 'https://odonto-excellence-api.onrender.com/api/management';
const REFRESH_MS = 20_000;

type ActionRow = { id: string; date: string };
type LeadRow = {
  id: number;
  action_id: string;
  sheet_number?: number | null;
  name: string;
  phone_raw?: string | null;
  phone_normalized?: string | null;
  scheduled_by?: string | null;
  updated_at?: string | null;
};
type Bootstrap = { actions: ActionRow[]; leads: LeadRow[] };

let snapshot: Bootstrap | null = null;
let inflight: Promise<void> | null = null;
let observer: MutationObserver | null = null;
let decorateTimer = 0;
let refreshInterval = 0;

function normalize(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function digits(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}

function selectedDate() {
  const raw = document.querySelector('.mg-day-heading .mg-eyebrow')?.textContent?.trim() || '';
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
}

function formattedUpdate(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || '';
  const day = part('day');
  const month = part('month');
  const hour = part('hour');
  const minute = part('minute');
  return day && month && hour && minute ? `${day}/${month} às ${hour}:${minute}` : '';
}

function fullUpdateTitle(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

async function refreshData(force = false) {
  if (inflight) return inflight;
  if (!force && snapshot) {
    decorateRows();
    return;
  }

  inflight = fetch(`${API}/bootstrap?rowmeta=${Date.now()}`, { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new Error('row_metadata_bootstrap_failed');
      snapshot = await response.json() as Bootstrap;
      decorateRows();
    })
    .catch(() => undefined)
    .finally(() => { inflight = null; });

  return inflight;
}

function candidatesForCurrentDay() {
  if (!snapshot) return [];
  const date = selectedDate();
  if (!date) return [];
  const actionIds = new Set(snapshot.actions.filter((action) => action.date === date).map((action) => action.id));
  return snapshot.leads.filter((lead) => actionIds.has(lead.action_id));
}

function findLead(row: HTMLElement, candidates: LeadRow[]) {
  const cells = Array.from(row.children) as HTMLElement[];
  if (cells.length < 5) return null;

  const sequenceText = cells[0]?.textContent?.trim() || '';
  const name = normalize(cells[1]?.querySelector('b')?.textContent || cells[1]?.textContent || '');
  const phone = digits(cells[2]?.textContent || '');
  const sequence = /^\d+$/.test(sequenceText) ? Number(sequenceText) : null;

  let matches = candidates.filter((lead) => normalize(lead.name) === name);
  if (phone) {
    const phoneMatches = matches.filter((lead) => {
      const leadPhone = digits(lead.phone_normalized || lead.phone_raw || '');
      return leadPhone === phone || leadPhone.endsWith(phone) || phone.endsWith(leadPhone);
    });
    if (phoneMatches.length) matches = phoneMatches;
  }
  if (sequence !== null && matches.length > 1) {
    const bySequence = matches.find((lead) => lead.sheet_number === sequence);
    if (bySequence) return bySequence;
  }
  if (matches.length) return matches[0];

  if (sequence !== null) {
    const bySequence = candidates.find((lead) => lead.sheet_number === sequence && (!phone || digits(lead.phone_normalized || lead.phone_raw || '') === phone));
    if (bySequence) return bySequence;
  }
  return null;
}

function buildMetadata(lead: LeadRow) {
  const updated = formattedUpdate(lead.updated_at);
  const scheduledBy = String(lead.scheduled_by || '').trim();
  if (!updated && !scheduledBy) return null;

  const parts: string[] = [];
  if (scheduledBy) parts.push(`<span><b>Agendado por:</b> ${escapeHtml(scheduledBy)}</span>`);
  if (updated) parts.push(`<span><b>Atualizado:</b> ${escapeHtml(updated)}</span>`);

  return {
    html: parts.join('<i class="mg-row-meta-dot" aria-hidden="true"></i>'),
    signature: `${scheduledBy}|${lead.updated_at || ''}`,
    title: updated ? `Última modificação: ${fullUpdateTitle(lead.updated_at)} · horário de Brasília` : '',
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function decorateRows() {
  if (!snapshot) return;
  const candidates = candidatesForCurrentDay();
  if (!candidates.length) return;

  for (const row of Array.from(document.querySelectorAll<HTMLElement>('.mg-table-body .mg-table-row'))) {
    const lead = findLead(row, candidates);
    if (!lead) continue;
    const cells = Array.from(row.children) as HTMLElement[];
    const noteCell = cells[4];
    if (!noteCell) continue;

    const metadata = buildMetadata(lead);
    let element = noteCell.querySelector<HTMLElement>(':scope > .mg-row-meta-inline');
    if (!metadata) {
      element?.remove();
      continue;
    }

    if (!element) {
      element = document.createElement('span');
      element.className = 'mg-row-meta-inline';
      noteCell.append(element);
    }
    if (element.dataset.signature === metadata.signature) continue;
    element.dataset.signature = metadata.signature;
    element.innerHTML = metadata.html;
    if (metadata.title) element.title = metadata.title;
  }
}

function scheduleDecorate() {
  window.clearTimeout(decorateTimer);
  decorateTimer = window.setTimeout(decorateRows, 80);
}

function scheduleCanonicalRefresh() {
  window.setTimeout(() => void refreshData(true), 900);
  window.setTimeout(() => void refreshData(true), 5_000);
}

export function installManagementRowMetadata() {
  const marker = window as typeof window & { __managementRowMetadata?: boolean };
  if (marker.__managementRowMetadata) return;
  marker.__managementRowMetadata = true;

  void refreshData(true);
  refreshInterval = window.setInterval(() => void refreshData(true), REFRESH_MS);

  observer = new MutationObserver(scheduleDecorate);
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('change', (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.matches('.mg-status')) scheduleCanonicalRefresh();
  }, true);

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('.mg-form-actions, .mg-import-confirm, .mg-refresh, .mg-day-strip > button')) {
      scheduleCanonicalRefresh();
    }
  }, true);

  window.addEventListener('beforeunload', () => {
    observer?.disconnect();
    window.clearInterval(refreshInterval);
  }, { once: true });
}
