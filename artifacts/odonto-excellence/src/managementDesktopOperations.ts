import './managementDesktopOperations.css';
import type { ManagementSpreadsheetPayload } from './xlsxManagementParser';

const API = 'https://odonto-excellence-api.onrender.com/api/management';
const DEVICE_KEY = 'controle-gestao-device-v1';

type ImportResult = {
  ok: boolean;
  actions_created: number;
  leads: { inserted: number; updated: number; unchanged: number };
  conversions: { inserted: number; updated: number; unchanged: number };
  received?: { leads: number; conversions: number };
};

type Bootstrap = {
  actions: Array<{ id: string; date: string }>;
  leads: Array<{ action_id: string; value?: number | string | null }>;
  conversions: Array<{ effective_date?: string | null; value?: number | string | null; bonus?: number | string | null }>;
};

let modal: HTMLElement | null = null;
let selectedPayload: ManagementSpreadsheetPayload | null = null;
let selectedFileName = '';
let financeCache: { savedAt: number; data: Bootstrap } | null = null;
let financeTimer = 0;
let observer: MutationObserver | null = null;

function deviceId() {
  try { return localStorage.getItem(DEVICE_KEY) || 'gestao-importacao'; } catch { return 'gestao-importacao'; }
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(value) ? value : 0);
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function closeModal() {
  modal?.remove();
  modal = null;
}

function modalShell(title: string, body: string) {
  closeModal();
  const backdrop = document.createElement('div');
  backdrop.className = 'mg-import-backdrop';
  backdrop.innerHTML = `
    <section class="mg-import-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <header class="mg-import-head">
        <div><small>Atualização do Controle de Gestão</small><h2>${escapeHtml(title)}</h2></div>
        <button type="button" class="mg-import-close" aria-label="Fechar">×</button>
      </header>
      <div class="mg-import-body">${body}</div>
    </section>`;
  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop) closeModal();
  });
  backdrop.querySelector('.mg-import-close')?.addEventListener('click', closeModal);
  document.body.append(backdrop);
  modal = backdrop;
  return backdrop;
}

function showProgress(message: string) {
  modalShell('Lendo planilha', `<div class="mg-import-progress"><span class="mg-import-spinner"></span><b>${escapeHtml(message)}</b><span>O arquivo é processado somente neste momento.</span></div>`);
}

function showError(message: string) {
  modalShell('Não foi possível importar', `
    <div class="mg-import-error">${escapeHtml(message)}</div>
    <div class="mg-import-actions"><button type="button" class="mg-import-cancel" data-close>Fechar</button></div>`
  ).querySelector('[data-close]')?.addEventListener('click', closeModal);
}

function showPreview(file: File, payload: ManagementSpreadsheetPayload) {
  selectedFileName = file.name;
  selectedPayload = payload;
  const firstDate = payload.actionDates[0] || '';
  const lastDate = payload.actionDates[payload.actionDates.length - 1] || '';
  const dateRange = payload.actionDates.length
    ? `${firstDate.split('-').reverse().join('/')} até ${lastDate.split('-').reverse().join('/')}`
    : 'nenhuma data de ação';

  const shell = modalShell('Importar planilha', `
    <div class="mg-import-file"><b>${escapeHtml(file.name)}</b><span>${(file.size / 1024).toFixed(0)} KB</span></div>
    <div class="mg-import-preview">
      <div class="mg-import-stat"><strong>${payload.leads.length}</strong><span>contatos detectados</span></div>
      <div class="mg-import-stat"><strong>${payload.conversions.length}</strong><span>conversões detectadas</span></div>
      <div class="mg-import-stat"><strong>${payload.actionDates.length}</strong><span>dias de ação</span></div>
    </div>
    <div class="mg-import-explain"><b>Como funciona:</b> registros já existentes são comparados pela origem da linha e, como proteção extra, por data da ação + telefone/nome. O que mudou é atualizado e o que ainda não existe é inserido.</div>
    <div class="mg-import-warning">Período reconhecido: <b>${escapeHtml(dateRange)}</b>. A importação não apaga contatos que não estejam na planilha e não duplica deliberadamente registros já reconhecidos.</div>
    <div class="mg-import-actions">
      <button type="button" class="mg-import-cancel" data-cancel>Cancelar</button>
      <button type="button" class="mg-import-confirm" data-confirm>Confirmar importação</button>
    </div>`);
  shell.querySelector('[data-cancel]')?.addEventListener('click', closeModal);
  shell.querySelector('[data-confirm]')?.addEventListener('click', () => void executeImport());
}

async function executeImport() {
  if (!selectedPayload) return;
  const payload = selectedPayload;
  showProgress('Comparando e atualizando os registros...');
  try {
    const response = await fetch(`${API}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads: payload.leads, conversions: payload.conversions, device_id: deviceId() }),
    });
    const result = await response.json().catch(() => ({})) as ImportResult & { error?: string };
    if (!response.ok) throw new Error(result.error || 'A importação foi recusada pelo servidor.');
    financeCache = null;
    const shell = modalShell('Importação concluída', `
      <div class="mg-import-file"><b>${escapeHtml(selectedFileName)}</b><span>sincronizada</span></div>
      <div class="mg-import-result">
        <div class="mg-import-stat"><strong>${result.leads.inserted}</strong><span>contatos novos</span></div>
        <div class="mg-import-stat"><strong>${result.leads.updated}</strong><span>contatos atualizados</span></div>
        <div class="mg-import-stat"><strong>${result.leads.unchanged}</strong><span>contatos sem mudança</span></div>
        <div class="mg-import-stat"><strong>${result.conversions.inserted}</strong><span>conversões novas</span></div>
        <div class="mg-import-stat"><strong>${result.conversions.updated}</strong><span>conversões atualizadas</span></div>
        <div class="mg-import-stat"><strong>${result.actions_created}</strong><span>novos dias criados</span></div>
      </div>
      <div class="mg-import-explain"><b>Sincronização finalizada.</b> O Controle de Gestão será atualizado com o estado reconciliado do banco.</div>
      <div class="mg-import-actions"><button type="button" class="mg-import-confirm" data-finish>Concluir</button></div>`);
    shell.querySelector('[data-finish]')?.addEventListener('click', () => {
      closeModal();
      document.querySelector<HTMLButtonElement>('.mg-refresh')?.click();
      scheduleFinanceRefresh(true);
    });
  } catch (reason) {
    showError(reason instanceof Error ? reason.message : 'Falha inesperada durante a importação.');
  }
}

async function chooseFile(file: File) {
  showProgress('Reconhecendo abas e registros...');
  try {
    const { parseManagementWorkbook } = await import('./xlsxManagementParser');
    const payload = await parseManagementWorkbook(file);
    showPreview(file, payload);
  } catch (reason) {
    showError(reason instanceof Error ? reason.message : 'Não foi possível ler essa planilha.');
  }
}

function ensureImportButton() {
  if (window.matchMedia('(max-width: 760px)').matches) return;
  const actions = document.querySelector<HTMLElement>('.mg-title-actions');
  if (!actions || actions.querySelector('.mg-import-button')) return;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  input.className = 'mg-import-input';
  input.setAttribute('aria-hidden', 'true');
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    if (file) void chooseFile(file);
  });

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mg-button secondary mg-import-button';
  button.setAttribute('aria-label', 'Importar dados atualizados de uma planilha Excel');
  button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg><span>Importar planilha</span>';
  button.addEventListener('click', () => input.click());

  actions.prepend(input);
  actions.prepend(button);
}

function selectedDate() {
  const text = document.querySelector('.mg-day-heading .mg-eyebrow')?.textContent?.trim() || '';
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
}

async function loadBootstrap(force = false) {
  if (!force && financeCache && Date.now() - financeCache.savedAt < 15_000) return financeCache.data;
  const response = await fetch(`${API}/bootstrap`, { cache: 'no-store' });
  if (!response.ok) throw new Error('finance_bootstrap_failed');
  const data = await response.json() as Bootstrap;
  financeCache = { savedAt: Date.now(), data };
  return data;
}

function financialPanel(date: string, data: Bootstrap) {
  const actionIds = new Set(data.actions.filter((action) => action.date === date).map((action) => action.id));
  const leads = data.leads.filter((lead) => actionIds.has(lead.action_id));
  const conversions = data.conversions.filter((item) => item.effective_date === date);
  const actionValue = leads.reduce((sum, item) => sum + numberValue(item.value), 0);
  const conversionValue = conversions.reduce((sum, item) => sum + numberValue(item.value), 0);
  const bonusValue = conversions.reduce((sum, item) => sum + numberValue(item.bonus), 0);
  return { actionValue, conversionValue, bonusValue, conversions: conversions.length };
}

async function refreshFinancialClarity(force = false) {
  const metrics = document.querySelector<HTMLElement>('.mg-metrics');
  const date = selectedDate();
  if (!metrics || !date) return;
  try {
    const data = await loadBootstrap(force);
    const values = financialPanel(date, data);

    const metricCards = metrics.querySelectorAll<HTMLElement>('.mg-metric');
    const financeMetric = metricCards[3];
    if (financeMetric) {
      const label = financeMetric.querySelector<HTMLElement>('.mg-metric-head span');
      const strong = financeMetric.querySelector<HTMLElement>('strong');
      const detail = financeMetric.querySelector<HTMLElement>('small');
      if (label) label.textContent = 'Valor das conversões';
      if (strong) strong.textContent = formatMoney(values.conversionValue);
      if (detail) detail.textContent = `${values.conversions} ${values.conversions === 1 ? 'conversão' : 'conversões'} · demais valores separados abaixo`;
    }

    let panel = document.querySelector<HTMLElement>('.mg-finance-clarity');
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'mg-finance-clarity';
      metrics.insertAdjacentElement('afterend', panel);
    }
    panel.innerHTML = `
      <div class="mg-finance-head">
        <div><b>Entenda os valores deste dia</b><span>Cada categoria fica separada para não misturar valores de naturezas diferentes.</span></div>
        <span class="mg-finance-badge">Resumo financeiro</span>
      </div>
      <div class="mg-finance-grid">
        <div class="mg-finance-item"><small>Valores na ação</small><strong>${formatMoney(values.actionValue)}</strong><em>Soma da coluna “Valor” dos contatos da ação.</em></div>
        <div class="mg-finance-item"><small>Valor das conversões</small><strong>${formatMoney(values.conversionValue)}</strong><em>Valores dos registros na aba Conversões.</em></div>
        <div class="mg-finance-item"><small>Bônus de conversão</small><strong>${formatMoney(values.bonusValue)}</strong><em>Bônus informado separadamente. Não é somado aos valores acima.</em></div>
      </div>`;
  } catch {
    // Financial explanation is supplementary and must never block management use.
  }
}

function scheduleFinanceRefresh(force = false) {
  window.clearTimeout(financeTimer);
  financeTimer = window.setTimeout(() => void refreshFinancialClarity(force), 120);
}

function installDayHooks() {
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('.mg-day-strip button, .mg-refresh')) scheduleFinanceRefresh(true);
  }, true);
}

export function installManagementDesktopOperations() {
  const marker = window as typeof window & { __managementDesktopOperations?: boolean };
  if (marker.__managementDesktopOperations) return;
  marker.__managementDesktopOperations = true;

  ensureImportButton();
  scheduleFinanceRefresh();
  installDayHooks();

  observer = new MutationObserver(() => {
    ensureImportButton();
    if (!document.querySelector('.mg-finance-clarity')) scheduleFinanceRefresh();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
