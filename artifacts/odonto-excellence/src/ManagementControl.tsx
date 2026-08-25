import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileClock,
  History,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  UsersRound,
  X,
} from 'lucide-react';

const API = 'https://odonto-excellence-acoes.onrender.com/api/public';
const DEVICE_KEY = 'controle-gestao-device-v1';
const STATUS_OPTIONS = [
  'Novo',
  'Aguardando',
  'Enviado mensagem',
  'Agendado Sistema',
  'Não tem interesse',
  'Número incorreto',
];

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
  sheet_number?: number | null;
  name: string;
  phone_raw?: string | null;
  phone_normalized?: string | null;
  captured_by?: string | null;
  appointment_note?: string | null;
  status: string;
  scheduled_by?: string | null;
  outcome?: string | null;
  outcome_date?: string | null;
  value?: number | string | null;
  updated_at?: string;
  action_date?: string;
};

type ConversionRow = {
  id: number;
  name: string;
  effective_date?: string | null;
  value?: number | string | null;
  tool?: string | null;
  scheduled_by?: string | null;
  converted_by?: string | null;
  bonus?: number | string | null;
  updated_at?: string;
};

type AuditRow = {
  id: number;
  event: string;
  actor_name: string;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
  created_at: string;
};

type PresenceRow = {
  device_id: string;
  avatar_code: string;
  activity?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  activity_label?: string | null;
  last_seen: string;
};

type Bootstrap = {
  actions: ActionRow[];
  leads: LeadRow[];
  conversions: ConversionRow[];
  teamMembers: string[];
  auditCount: number;
};

const EMPTY: Bootstrap = {
  actions: [],
  leads: [],
  conversions: [],
  teamMembers: [],
  auditCount: 0,
};

function getDeviceId() {
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    if (saved) return saved;
    const id = `web-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return `web-session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function formatMoney(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(parsed) ? parsed : 0);
}

function shortDate(value?: string | null) {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day));
}

function dayLabel(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return {
    weekday: new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(date).replace('.', ''),
    date: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date),
  };
}

function dateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function normalize(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

async function request<T>(path: string, deviceId: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  let body = init?.body;
  if (method !== 'GET' && method !== 'HEAD') {
    const raw = typeof body === 'string' && body ? JSON.parse(body) as Record<string, unknown> : {};
    body = JSON.stringify({ ...raw, device_id: deviceId });
  }
  const response = await fetch(`${API}${path}`, {
    ...init,
    body,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.');
  return payload;
}

function statusTone(status: string) {
  if (status === 'Agendado Sistema') return 'scheduled';
  if (status === 'Não tem interesse' || status === 'Número incorreto') return 'closed';
  if (status === 'Aguardando' || status === 'Enviado mensagem') return 'waiting';
  return 'new';
}

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Activity }) {
  return (
    <article className="mg-metric">
      <div className="mg-metric-head"><span>{label}</span><Icon size={16} /></div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Modal({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="mg-modal-backdrop" onMouseDown={onClose}>
      <section className="mg-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="mg-modal-head">
          <div><span>{eyebrow}</span><h2>{title}</h2></div>
          <button type="button" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

function Presence({ people, selfId }: { people: PresenceRow[]; selfId: string }) {
  return (
    <aside className="mg-presence" aria-label="Pessoas online">
      <div className="mg-presence-title"><span className="mg-online-dot" /><b>{people.length}</b> online</div>
      <div className="mg-presence-avatars">
        {people.slice(0, 6).map((person) => (
          <span
            key={person.device_id}
            className={`mg-avatar ${person.device_id === selfId ? 'self' : ''}`}
            title={`${person.avatar_code}${person.device_id === selfId ? ' · este dispositivo' : ''}${person.activity_label ? ` · ${person.activity_label}` : ''}`}
          >
            {person.avatar_code}
            <i />
          </span>
        ))}
        {people.length > 6 ? <span className="mg-avatar more">+{people.length - 6}</span> : null}
      </div>
      <div className="mg-presence-activity">
        {people.find((person) => person.device_id !== selfId && person.activity_label)?.activity_label || 'Operação compartilhada em tempo real'}
      </div>
    </aside>
  );
}

export default function ManagementControl() {
  const deviceIdRef = useRef(getDeviceId());
  const deviceId = deviceIdRef.current;
  const [data, setData] = useState<Bootstrap>(EMPTY);
  const [presence, setPresence] = useState<PresenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'leads' | 'conversions'>('leads');
  const [selectedDate, setSelectedDate] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingLead, setEditingLead] = useState<LeadRow | null>(null);
  const [historyLead, setHistoryLead] = useState<LeadRow | null>(null);
  const [history, setHistory] = useState<AuditRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [newActionOpen, setNewActionOpen] = useState(false);
  const [newConversionOpen, setNewConversionOpen] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await request<Bootstrap>('/bootstrap', deviceId);
      setData(next);
      setSelectedDate((current) => current || next.actions[0]?.date || '');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao carregar os dados.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [deviceId]);

  const heartbeat = useCallback(async (
    activity = 'online',
    activityLabel = 'Consultando o controle',
    entityType?: string,
    entityId?: string,
  ) => {
    try {
      const result = await request<{ people: PresenceRow[] }>('/presence', deviceId, {
        method: 'POST',
        body: JSON.stringify({ activity, activity_label: activityLabel, entity_type: entityType, entity_id: entityId }),
      });
      setPresence(result.people || []);
    } catch {
      // Presence is supplementary. Operational data remains available if it fails.
    }
  }, [deviceId]);

  useEffect(() => {
    void Promise.all([load(), heartbeat()]);
  }, [heartbeat, load]);

  useEffect(() => {
    const dataTimer = window.setInterval(() => void load(true), 20_000);
    const presenceTimer = window.setInterval(() => void heartbeat(), 12_000);
    return () => {
      window.clearInterval(dataTimer);
      window.clearInterval(presenceTimer);
    };
  }, [heartbeat, load]);

  useEffect(() => {
    if (editingLead) void heartbeat('editing', `Editando ${editingLead.name}`, 'lead', String(editingLead.id));
    else if (newLeadOpen) void heartbeat('editing', 'Cadastrando novo lead', 'lead');
    else if (newActionOpen) void heartbeat('editing', 'Criando nova ação', 'action');
    else if (newConversionOpen) void heartbeat('editing', 'Registrando conversão', 'conversion');
    else if (tab === 'conversions') void heartbeat('viewing', 'Consultando conversões', 'conversion');
    else void heartbeat('viewing', selectedDate ? `Consultando ${shortDate(selectedDate)}` : 'Consultando ações', 'action');
  }, [editingLead, heartbeat, newActionOpen, newConversionOpen, newLeadOpen, selectedDate, tab]);

  useEffect(() => {
    if (!query.trim()) return;
    const timer = window.setTimeout(() => void heartbeat('typing', 'Pesquisando registros', 'search'), 350);
    return () => window.clearTimeout(timer);
  }, [heartbeat, query]);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  }

  const dates = useMemo(() => {
    const grouped = new Map<string, { actions: number; leads: number }>();
    for (const action of data.actions) grouped.set(action.date, { actions: (grouped.get(action.date)?.actions || 0) + 1, leads: grouped.get(action.date)?.leads || 0 });
    for (const lead of data.leads) {
      const action = data.actions.find((item) => item.id === lead.action_id);
      if (!action) continue;
      const current = grouped.get(action.date) || { actions: 0, leads: 0 };
      current.leads += 1;
      grouped.set(action.date, current);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [data.actions, data.leads]);

  const actionsForDay = useMemo(() => data.actions.filter((action) => action.date === selectedDate), [data.actions, selectedDate]);
  const actionIdsForDay = useMemo(() => new Set(actionsForDay.map((action) => action.id)), [actionsForDay]);
  const dayLeads = useMemo(() => data.leads.filter((lead) => actionIdsForDay.has(lead.action_id)), [actionIdsForDay, data.leads]);
  const statuses = useMemo(() => Array.from(new Set(dayLeads.map((lead) => lead.status).filter(Boolean))).sort(), [dayLeads]);
  const filteredLeads = useMemo(() => {
    const needle = normalize(query);
    return dayLeads.filter((lead) => {
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
      if (!needle) return true;
      return normalize([lead.name, lead.phone_raw, lead.captured_by, lead.scheduled_by, lead.appointment_note, lead.status, lead.outcome].join(' ')).includes(needle);
    });
  }, [dayLeads, query, statusFilter]);

  const dayConversions = useMemo(() => data.conversions.filter((item) => item.effective_date === selectedDate), [data.conversions, selectedDate]);
  const scheduled = dayLeads.filter((lead) => lead.status === 'Agendado Sistema').length;
  const effective = dayLeads.filter((lead) => lead.outcome === 'Efetivado').length;
  const dayValue = dayLeads.reduce((sum, lead) => sum + Number(lead.value || 0), 0);
  const conversionValue = dayConversions.reduce((sum, item) => sum + Number(item.value || 0), 0);

  const actionMap = useMemo(() => new Map(data.actions.map((item) => [item.id, item])), [data.actions]);

  async function quickStatus(lead: LeadRow, status: string) {
    const previous = lead.status;
    setData((current) => ({ ...current, leads: current.leads.map((item) => item.id === lead.id ? { ...item, status } : item) }));
    try {
      await request(`/leads/${lead.id}`, deviceId, { method: 'PATCH', body: JSON.stringify({ status }) });
      flash('Status atualizado.');
      void heartbeat('editing', `Atualizou ${lead.name}`, 'lead', String(lead.id));
    } catch (reason) {
      setData((current) => ({ ...current, leads: current.leads.map((item) => item.id === lead.id ? { ...item, status: previous } : item) }));
      setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o status.');
    }
  }

  async function openHistory(lead: LeadRow) {
    setHistoryLead(lead);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const result = await request<{ history: AuditRow[] }>(`/leads/${lead.id}/history`, deviceId);
      setHistory(result.history || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o histórico.');
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <main className="mg-root">
      <header className="mg-header">
        <a href="/" className="mg-brand"><span className="mg-brand-mark">CG</span><span><b>Controle de Gestão</b><small>captação, agenda e conversão</small></span></a>
        <div className="mg-header-right">
          <Presence people={presence} selfId={deviceId} />
          <a href="/acesso" className="mg-private-link">Ambiente privado <ExternalLink size={13} /></a>
        </div>
      </header>

      <section className="mg-main">
        <div className="mg-title-row">
          <div>
            <span className="mg-eyebrow">Operação compartilhada</span>
            <h1>Ações por dia</h1>
            <p>Registros de captação, agendamentos e conversões com atualização compartilhada e histórico de alterações.</p>
          </div>
          <div className="mg-title-actions">
            <button type="button" className="mg-button secondary" onClick={() => setNewActionOpen(true)}><MapPin size={14} /> Nova ação</button>
            <button type="button" className="mg-button primary" onClick={() => setNewLeadOpen(true)} disabled={!actionsForDay.length}><Plus size={14} /> Novo lead</button>
          </div>
        </div>

        <nav className="mg-day-strip" aria-label="Dias de ação">
          {dates.map(([date, counts]) => {
            const label = dayLabel(date);
            return (
              <button key={date} type="button" className={selectedDate === date ? 'active' : ''} onClick={() => { setSelectedDate(date); setStatusFilter('all'); }}>
                <span>{label.weekday}</span><b>{label.date}</b><small>{counts.leads} leads</small>
              </button>
            );
          })}
        </nav>

        <section className="mg-day-heading">
          <div>
            <span className="mg-eyebrow">{shortDate(selectedDate)}</span>
            <h2>{actionsForDay.map((item) => item.location || item.name).filter(Boolean).join(' · ') || 'Sem ação selecionada'}</h2>
          </div>
          <button type="button" className="mg-refresh" onClick={() => void load(true)} disabled={refreshing}><RefreshCw size={14} className={refreshing ? 'mg-spin' : ''} /> {refreshing ? 'Atualizando' : 'Atualizar'}</button>
        </section>

        <div className="mg-metrics">
          <Metric label="Leads do dia" value={String(dayLeads.length)} detail={`${actionsForDay.length} ${actionsForDay.length === 1 ? 'ação' : 'ações'}`} icon={UsersRound} />
          <Metric label="Agendados" value={String(scheduled)} detail={`${dayLeads.length ? Math.round((scheduled / dayLeads.length) * 100) : 0}% dos leads`} icon={CalendarDays} />
          <Metric label="Efetivados" value={String(effective)} detail={`${dayLeads.filter((lead) => !lead.outcome).length} sem desfecho`} icon={CheckCircle2} />
          <Metric label="Valores registrados" value={formatMoney(dayValue + conversionValue)} detail={`${dayConversions.length} conversões no dia`} icon={TrendingUp} />
        </div>

        <div className="mg-tabs-row">
          <div className="mg-tabs">
            <button type="button" className={tab === 'leads' ? 'active' : ''} onClick={() => setTab('leads')}><Activity size={14} /> Ação e leads</button>
            <button type="button" className={tab === 'conversions' ? 'active' : ''} onClick={() => setTab('conversions')}><BarChart3 size={14} /> Conversões</button>
          </div>
          {tab === 'conversions' ? <button type="button" className="mg-button primary compact" onClick={() => setNewConversionOpen(true)}><Plus size={13} /> Registrar conversão</button> : null}
        </div>

        {error ? <div className="mg-alert error">{error}<button type="button" onClick={() => setError('')}><X size={14} /></button></div> : null}
        {notice ? <div className="mg-alert success"><CheckCircle2 size={14} /> {notice}</div> : null}

        {loading ? (
          <section className="mg-loading"><span /><b>Carregando dados...</b></section>
        ) : tab === 'leads' ? (
          <>
            <section className="mg-filters">
              <label className="mg-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, telefone, responsável ou observação" /></label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Todos os status</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
              <span>{filteredLeads.length} registros</span>
            </section>

            <section className="mg-table-card">
              <div className="mg-table-head"><span>#</span><span>Nome</span><span>Contato</span><span>Abordagem</span><span>Observação / agendamento</span><span>Status</span><span>Efetivação</span><span>Valor</span><span /></div>
              <div className="mg-table-body">
                {filteredLeads.map((lead) => (
                  <div className="mg-table-row" key={lead.id}>
                    <span className="mg-seq">{lead.sheet_number ?? '—'}</span>
                    <div><b>{lead.name}</b><small>{actionMap.get(lead.action_id)?.name || 'Ação'}</small></div>
                    <span>{lead.phone_raw || '—'}</span>
                    <span>{lead.captured_by || '—'}</span>
                    <span className="mg-note">{lead.appointment_note || '—'}</span>
                    <select className={`mg-status ${statusTone(lead.status)}`} value={lead.status || 'Novo'} onChange={(event) => void quickStatus(lead, event.target.value)}>{STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select>
                    <span>{lead.outcome || '—'}{lead.outcome_date ? <small>{shortDate(lead.outcome_date)}</small> : null}</span>
                    <span>{lead.value ? formatMoney(lead.value) : '—'}</span>
                    <div className="mg-row-actions"><button type="button" title="Histórico" onClick={() => void openHistory(lead)}><History size={14} /></button><button type="button" title="Editar" onClick={() => setEditingLead({ ...lead })}><Pencil size={14} /></button></div>
                  </div>
                ))}
                {!filteredLeads.length ? <div className="mg-empty">Nenhum registro para os filtros selecionados.</div> : null}
              </div>
            </section>
          </>
        ) : (
          <section className="mg-conversion-card">
            <header><div><span className="mg-eyebrow">Conversões de {shortDate(selectedDate)}</span><h2>{dayConversions.length} registros</h2></div><strong>{formatMoney(conversionValue)}</strong></header>
            <div className="mg-conversion-list">
              {dayConversions.map((item) => (
                <article key={item.id}><div><b>{item.name}</b><small>{item.tool || 'Conversão'} · {shortDate(item.effective_date)}</small></div><span><small>Agendado por</small>{item.scheduled_by || '—'}</span><span><small>Efetivado por</small>{item.converted_by || '—'}</span><strong>{formatMoney(item.value)}</strong></article>
              ))}
              {!dayConversions.length ? <div className="mg-empty">Nenhuma conversão registrada para este dia.</div> : null}
            </div>
          </section>
        )}
      </section>

      {editingLead ? (
        <Modal eyebrow="Editar registro" title={editingLead.name} onClose={() => setEditingLead(null)}>
          <LeadForm
            lead={editingLead}
            actions={data.actions}
            onCancel={() => setEditingLead(null)}
            onSubmit={async (payload) => {
              try {
                const updated = await request<LeadRow>(`/leads/${editingLead.id}`, deviceId, { method: 'PATCH', body: JSON.stringify(payload) });
                setData((current) => ({ ...current, leads: current.leads.map((item) => item.id === editingLead.id ? { ...item, ...updated } : item), auditCount: current.auditCount + 1 }));
                setEditingLead(null);
                flash('Registro salvo.');
              } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.'); }
            }}
          />
        </Modal>
      ) : null}

      {historyLead ? (
        <Modal eyebrow="Histórico de alterações" title={historyLead.name} onClose={() => setHistoryLead(null)}>
          <div className="mg-history">
            {historyLoading ? <div className="mg-loading compact"><span /><b>Carregando histórico...</b></div> : history.map((item) => <article key={item.id}><span className="mg-history-icon"><FileClock size={14} /></span><div><b>{item.event === 'create' ? 'Registro criado' : 'Registro atualizado'}</b><small>{item.actor_name} · {dateTime(item.created_at)}</small></div></article>)}
            {!historyLoading && !history.length ? <div className="mg-empty">Sem alterações registradas.</div> : null}
          </div>
        </Modal>
      ) : null}

      {newLeadOpen ? (
        <Modal eyebrow="Novo registro" title="Adicionar lead" onClose={() => setNewLeadOpen(false)}>
          <LeadForm actions={actionsForDay.length ? actionsForDay : data.actions} initialActionId={actionsForDay[0]?.id} onCancel={() => setNewLeadOpen(false)} onSubmit={async (payload) => {
            try {
              const created = await request<LeadRow>('/leads', deviceId, { method: 'POST', body: JSON.stringify(payload) });
              setData((current) => ({ ...current, leads: [created, ...current.leads], auditCount: current.auditCount + 1 }));
              setNewLeadOpen(false);
              flash('Lead adicionado.');
              void load(true);
            } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível adicionar o lead.'); }
          }} />
        </Modal>
      ) : null}

      {newActionOpen ? (
        <Modal eyebrow="Ações de rua" title="Nova ação" onClose={() => setNewActionOpen(false)}>
          <ActionForm onCancel={() => setNewActionOpen(false)} onSubmit={async (payload) => {
            try {
              const created = await request<ActionRow>('/actions', deviceId, { method: 'POST', body: JSON.stringify(payload) });
              setData((current) => ({ ...current, actions: [created, ...current.actions], auditCount: current.auditCount + 1 }));
              setSelectedDate(created.date);
              setNewActionOpen(false);
              flash('Ação criada.');
            } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível criar a ação.'); }
          }} />
        </Modal>
      ) : null}

      {newConversionOpen ? (
        <Modal eyebrow="Conversões" title="Registrar conversão" onClose={() => setNewConversionOpen(false)}>
          <ConversionForm defaultDate={selectedDate} onCancel={() => setNewConversionOpen(false)} onSubmit={async (payload) => {
            try {
              const created = await request<ConversionRow>('/conversions', deviceId, { method: 'POST', body: JSON.stringify(payload) });
              setData((current) => ({ ...current, conversions: [created, ...current.conversions], auditCount: current.auditCount + 1 }));
              setNewConversionOpen(false);
              flash('Conversão registrada.');
            } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível registrar a conversão.'); }
          }} />
        </Modal>
      ) : null}

      <footer className="mg-footer"><span>Controle de Gestão</span><span>Dados compartilhados · histórico ativo</span><a href="/acesso">Solicitar acesso ao ambiente privado <ArrowRight size={12} /></a></footer>
    </main>
  );
}

function LeadForm({ lead, actions, initialActionId, onCancel, onSubmit }: { lead?: LeadRow; actions: ActionRow[]; initialActionId?: string; onCancel: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({
    action_id: lead?.action_id || initialActionId || actions[0]?.id || '',
    name: lead?.name || '',
    phone_raw: lead?.phone_raw || '',
    captured_by: lead?.captured_by || '',
    appointment_note: lead?.appointment_note || '',
    status: lead?.status || 'Novo',
    scheduled_by: lead?.scheduled_by || '',
    outcome: lead?.outcome || '',
    outcome_date: lead?.outcome_date || '',
    value: lead?.value ? String(lead.value) : '',
  });
  const [busy, setBusy] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <form className="mg-form" onSubmit={(event) => { event.preventDefault(); if (busy) return; setBusy(true); void onSubmit(form).finally(() => setBusy(false)); }}>
      <div className="mg-form-grid">
        <label className="wide"><span>Ação</span><select value={form.action_id} onChange={(event) => update('action_id', event.target.value)} required>{actions.map((action) => <option key={action.id} value={action.id}>{shortDate(action.date)} · {action.location || action.name}</option>)}</select></label>
        <label className="wide"><span>Nome</span><input value={form.name} onChange={(event) => update('name', event.target.value)} required /></label>
        <label><span>Contato</span><input value={form.phone_raw} onChange={(event) => update('phone_raw', event.target.value)} /></label>
        <label><span>Quem abordou</span><input value={form.captured_by} onChange={(event) => update('captured_by', event.target.value)} /></label>
        <label className="wide"><span>Observação / agendamento</span><textarea value={form.appointment_note} onChange={(event) => update('appointment_note', event.target.value)} rows={3} /></label>
        <label><span>Status</span><select value={form.status} onChange={(event) => update('status', event.target.value)}>{STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select></label>
        <label><span>Agendado por</span><input value={form.scheduled_by} onChange={(event) => update('scheduled_by', event.target.value)} /></label>
        <label><span>Efetivação</span><select value={form.outcome} onChange={(event) => update('outcome', event.target.value)}><option value="">Pendente</option><option>Efetivado</option><option>Não Efetivado</option></select></label>
        <label><span>Data da efetivação</span><input type="date" value={form.outcome_date} onChange={(event) => update('outcome_date', event.target.value)} /></label>
        <label><span>Valor</span><input inputMode="decimal" value={form.value} onChange={(event) => update('value', event.target.value)} /></label>
      </div>
      <div className="mg-form-actions"><button type="button" className="mg-button secondary" onClick={onCancel}>Cancelar</button><button type="submit" className="mg-button primary" disabled={busy}>{busy ? 'Salvando...' : 'Salvar registro'}</button></div>
    </form>
  );
}

function ActionForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('São Francisco');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  return <form className="mg-form" onSubmit={(event) => { event.preventDefault(); if (busy) return; setBusy(true); void onSubmit({ date, location, name }).finally(() => setBusy(false)); }}><div className="mg-form-grid"><label><span>Data</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label><span>Local</span><input value={location} onChange={(event) => setLocation(event.target.value)} required /></label><label className="wide"><span>Nome da ação</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Opcional" /></label></div><div className="mg-form-actions"><button type="button" className="mg-button secondary" onClick={onCancel}>Cancelar</button><button className="mg-button primary" disabled={busy}>{busy ? 'Criando...' : 'Criar ação'}</button></div></form>;
}

function ConversionForm({ defaultDate, onCancel, onSubmit }: { defaultDate: string; onCancel: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ name: '', effective_date: defaultDate, value: '', tool: 'Conversão', scheduled_by: '', converted_by: '', bonus: '50' });
  const [busy, setBusy] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <form className="mg-form" onSubmit={(event) => { event.preventDefault(); if (busy) return; setBusy(true); void onSubmit(form).finally(() => setBusy(false)); }}><div className="mg-form-grid"><label className="wide"><span>Paciente</span><input value={form.name} onChange={(event) => update('name', event.target.value)} required /></label><label><span>Data</span><input type="date" value={form.effective_date} onChange={(event) => update('effective_date', event.target.value)} /></label><label><span>Valor</span><input inputMode="decimal" value={form.value} onChange={(event) => update('value', event.target.value)} /></label><label><span>Origem</span><select value={form.tool} onChange={(event) => update('tool', event.target.value)}><option>Conversão</option><option>Amigo do Peito</option></select></label><label><span>Agendado por</span><input value={form.scheduled_by} onChange={(event) => update('scheduled_by', event.target.value)} /></label><label><span>Efetivado por</span><input value={form.converted_by} onChange={(event) => update('converted_by', event.target.value)} /></label><label><span>Bônus</span><input inputMode="decimal" value={form.bonus} onChange={(event) => update('bonus', event.target.value)} /></label></div><div className="mg-form-actions"><button type="button" className="mg-button secondary" onClick={onCancel}>Cancelar</button><button className="mg-button primary" disabled={busy}>{busy ? 'Salvando...' : 'Registrar conversão'}</button></div></form>;
}
