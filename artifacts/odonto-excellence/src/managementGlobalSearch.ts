import './managementGlobalSearch.css';

const API = 'https://odonto-excellence-api.onrender.com/api/management';
const MAX_RESULTS = 60;

type ActionRow = {
  id: string;
  name: string;
  date: string;
  location?: string | null;
  campaign?: string | null;
};

type LeadRow = {
  id: number;
  action_id: string;
  name: string;
  phone_raw?: string | null;
  phone_normalized?: string | null;
  captured_by?: string | null;
  appointment_note?: string | null;
  status?: string | null;
  scheduled_by?: string | null;
  outcome?: string | null;
  outcome_date?: string | null;
  value?: number | string | null;
};

type ConversionRow = {
  id: number;
  name: string;
  effective_date?: string | null;
  value?: number | string | null;
  tool?: string | null;
  scheduled_by?: string | null;
  converted_by?: string | null;
};

type Bootstrap = {
  actions: ActionRow[];
  leads: LeadRow[];
  conversions: ConversionRow[];
};

type Result = {
  key: string;
  kind: 'lead' | 'conversion';
  date: string;
  title: string;
  primary: string;
  secondary: string;
  searchText: string;
};

let data: Bootstrap | null = null;
let loadingPromise: Promise<Bootstrap> | null = null;
let root: HTMLElement | null = null;
let input: HTMLInputElement | null = null;
let resultsBox: HTMLElement | null = null;
let allResults: Result[] = [];
let observer: MutationObserver | null = null;
let refreshTimer = 0;

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

function shortDate(date: string) {
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}/${month}/${year}` : date;
}

function shortDay(date: string) {
  const [, month, day] = date.split('-');
  return month && day ? `${day}/${month}` : date;
}

function money(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parsed);
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function loadData(force = false) {
  if (!force && data) return data;
  if (!force && loadingPromise) return loadingPromise;
  loadingPromise = fetch(`${API}/bootstrap`, { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new Error('global_search_bootstrap_failed');
      const next = await response.json() as Bootstrap;
      data = next;
      allResults = buildResults(next);
      markDayButtons(next.actions);
      return next;
    })
    .finally(() => { loadingPromise = null; });
  return loadingPromise;
}

function buildResults(next: Bootstrap) {
  const actionMap = new Map(next.actions.map((action) => [action.id, action]));
  const results: Result[] = [];

  for (const lead of next.leads) {
    const action = actionMap.get(lead.action_id);
    if (!action?.date) continue;
    const phone = lead.phone_raw || lead.phone_normalized || '';
    const responsible = lead.captured_by || lead.scheduled_by || 'Sem responsável';
    const status = lead.outcome || lead.status || 'Sem status';
    const searchable = [
      lead.name,
      phone,
      digits(phone),
      lead.captured_by,
      lead.scheduled_by,
      lead.appointment_note,
      lead.status,
      lead.outcome,
      lead.outcome_date,
      lead.value,
      action.name,
      action.location,
      action.campaign,
      action.date,
      shortDate(action.date),
      shortDay(action.date),
    ];
    results.push({
      key: `lead-${lead.id}`,
      kind: 'lead',
      date: action.date,
      title: lead.name,
      primary: phone || 'Sem telefone',
      secondary: `${responsible} · ${status}`,
      searchText: normalize(searchable.join(' ')),
    });
  }

  for (const conversion of next.conversions) {
    const date = conversion.effective_date || '';
    if (!date) continue;
    const responsible = conversion.converted_by || conversion.scheduled_by || 'Sem responsável';
    const value = money(conversion.value);
    const searchable = [
      conversion.name,
      conversion.tool,
      conversion.scheduled_by,
      conversion.converted_by,
      conversion.value,
      date,
      shortDate(date),
      shortDay(date),
      'conversao',
      'efetivado',
    ];
    results.push({
      key: `conversion-${conversion.id}`,
      kind: 'conversion',
      date,
      title: conversion.name,
      primary: value || conversion.tool || 'Conversão',
      secondary: `${responsible} · ${conversion.tool || 'Conversão'}`,
      searchText: normalize(searchable.join(' ')),
    });
  }

  return results.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'pt-BR'));
}

function markDayButtons(actions: ActionRow[]) {
  const uniqueDates = Array.from(new Set(actions.map((action) => action.date))).sort((a, b) => b.localeCompare(a));
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.mg-day-strip > button'));
  for (const button of buttons) delete button.dataset.globalDate;
  uniqueDates.forEach((date, index) => {
    const button = buttons[index];
    if (button) button.dataset.globalDate = date;
  });
}

function ensureDayMarkers() {
  if (data) markDayButtons(data.actions);
}

function openResult(result: Result) {
  ensureDayMarkers();
  const dayButton = document.querySelector<HTMLButtonElement>(`.mg-day-strip > button[data-global-date="${CSS.escape(result.date)}"]`);
  dayButton?.click();

  if (result.kind === 'conversion') {
    window.setTimeout(() => {
      const conversionTab = Array.from(document.querySelectorAll<HTMLButtonElement>('.mg-tabs button'))
        .find((button) => normalize(button.textContent).includes('convers'));
      conversionTab?.click();
      document.querySelector('.mg-conversion-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  } else {
    window.setTimeout(() => {
      const leadsTab = Array.from(document.querySelectorAll<HTMLButtonElement>('.mg-tabs button'))
        .find((button) => normalize(button.textContent).includes('acao e leads'));
      leadsTab?.click();
      document.querySelector('.mg-table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  if (input) input.value = '';
  root?.classList.remove('open', 'has-query');
}

function render(query: string) {
  if (!root || !resultsBox) return;
  const normalizedQuery = normalize(query);
  const numericQuery = digits(query);
  root.classList.toggle('has-query', Boolean(normalizedQuery));

  if (!normalizedQuery) {
    root.classList.remove('open');
    resultsBox.innerHTML = '';
    return;
  }

  const matches = allResults
    .filter((result) => result.searchText.includes(normalizedQuery) || (numericQuery.length >= 3 && result.searchText.includes(numericQuery)))
    .slice(0, MAX_RESULTS);

  root.classList.add('open');
  if (!matches.length) {
    resultsBox.innerHTML = '<div class="mg-global-search-empty">Nenhum registro encontrado em nenhum dos dias.</div>';
    return;
  }

  resultsBox.innerHTML = `
    <div class="mg-global-search-summary"><span><b>${matches.length}</b> ${matches.length === 1 ? 'resultado' : 'resultados'} encontrados</span><span>todos os dias</span></div>
    ${matches.map((result) => `
      <button type="button" class="mg-global-result" data-search-key="${escapeHtml(result.key)}">
        <span class="mg-global-result-main">
          <b>${escapeHtml(result.title)}</b>
          <span>${escapeHtml(result.primary)}</span>
          <span class="mg-global-result-kind">${result.kind === 'lead' ? 'Contato' : 'Conversão'}</span>
        </span>
        <span class="mg-global-result-meta">
          <strong>${escapeHtml(result.secondary)}</strong>
          <span>Clique para abrir o dia</span>
        </span>
        <span class="mg-global-result-date">${escapeHtml(shortDate(result.date))}</span>
      </button>`).join('')}`;

  for (const button of Array.from(resultsBox.querySelectorAll<HTMLButtonElement>('[data-search-key]'))) {
    button.addEventListener('click', () => {
      const result = matches.find((item) => item.key === button.dataset.searchKey);
      if (result) openResult(result);
    });
  }
}

function ensureSearch() {
  if (window.matchMedia('(max-width: 760px)').matches) return;
  const main = document.querySelector<HTMLElement>('.mg-main');
  const titleRow = document.querySelector<HTMLElement>('.mg-title-row');
  if (!main || !titleRow) return;
  if (document.querySelector('.mg-global-search-wrap')) {
    root = document.querySelector('.mg-global-search-wrap');
    input = document.querySelector('.mg-global-search-box input');
    resultsBox = document.querySelector('.mg-global-search-results');
    ensureDayMarkers();
    return;
  }

  const wrap = document.createElement('section');
  wrap.className = 'mg-global-search-wrap';
  wrap.setAttribute('aria-label', 'Pesquisa em todos os dias');
  wrap.innerHTML = `
    <label class="mg-global-search-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <input type="search" autocomplete="off" spellcheck="false" placeholder="Pesquisar nome, telefone, responsável, status, observação ou data em todos os dias" aria-label="Pesquisar em todos os dias" />
      <span class="mg-global-search-scope">Todos os dias</span>
      <button type="button" class="mg-global-search-clear" aria-label="Limpar pesquisa">×</button>
    </label>
    <div class="mg-global-search-hint">Busca geral do Controle de Gestão. O filtro mais abaixo continua limitado ao dia selecionado.</div>
    <div class="mg-global-search-results" role="listbox"></div>`;

  titleRow.insertAdjacentElement('afterend', wrap);
  root = wrap;
  input = wrap.querySelector('input');
  resultsBox = wrap.querySelector('.mg-global-search-results');

  input?.addEventListener('focus', () => {
    if (!data) {
      if (resultsBox) resultsBox.innerHTML = '<div class="mg-global-search-loading">Preparando busca em todos os dias...</div>';
      if (input?.value.trim()) root?.classList.add('open');
      void loadData().then(() => render(input?.value || '')).catch(() => {
        if (resultsBox) resultsBox.innerHTML = '<div class="mg-global-search-empty">Não foi possível carregar a busca agora.</div>';
      });
    } else if (input?.value.trim()) {
      render(input.value);
    }
  });

  input?.addEventListener('input', () => {
    const value = input?.value || '';
    if (!data) {
      if (value.trim()) root?.classList.add('open', 'has-query');
      if (resultsBox) resultsBox.innerHTML = '<div class="mg-global-search-loading">Pesquisando todos os dias...</div>';
      void loadData().then(() => render(value)).catch(() => {
        if (resultsBox) resultsBox.innerHTML = '<div class="mg-global-search-empty">Não foi possível carregar a busca agora.</div>';
      });
      return;
    }
    render(value);
  });

  wrap.querySelector('.mg-global-search-clear')?.addEventListener('click', (event) => {
    event.preventDefault();
    if (input) {
      input.value = '';
      input.focus();
    }
    render('');
  });

  document.addEventListener('pointerdown', (event) => {
    if (!(event.target instanceof Node) || !root || root.contains(event.target)) return;
    root.classList.remove('open');
  });

  void loadData().catch(() => undefined);
}

function scheduleRefresh() {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    void loadData(true).then(() => {
      ensureDayMarkers();
      if (input?.value.trim()) render(input.value);
    }).catch(() => undefined);
  }, 180);
}

export function installManagementGlobalSearch() {
  const marker = window as typeof window & { __managementGlobalSearch?: boolean };
  if (marker.__managementGlobalSearch) return;
  marker.__managementGlobalSearch = true;

  ensureSearch();
  observer = new MutationObserver(() => {
    ensureSearch();
    ensureDayMarkers();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('.mg-refresh, .mg-import-confirm, .mg-modal button[type="submit"]')) scheduleRefresh();
  }, true);

  window.setInterval(() => {
    if (document.visibilityState === 'visible' && document.querySelector('.mg-root')) scheduleRefresh();
  }, 30_000);
}
