import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronRight,
  Clock3,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import './streetMobileControl.css';

const API = 'https://odonto-excellence-api.onrender.com/api/management';
const DEVICE_KEY = 'controle-gestao-device-v1';
const CAPTURED_BY_KEY = 'controle-gestao-street-captured-by-v1';

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
  captured_by?: string | null;
  appointment_note?: string | null;
  status: string;
  scheduled_by?: string | null;
  outcome?: string | null;
  updated_at?: string;
};

type PresenceRow = {
  device_id: string;
  avatar_code: string;
  activity_label?: string | null;
};

type Bootstrap = {
  actions: ActionRow[];
  leads: LeadRow[];
  conversions: unknown[];
  teamMembers: string[];
  auditCount: number;
};

type PresenceEnvelope = {
  people: PresenceRow[];
  self?: { device_id: string; avatar_code: string };
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

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function nextHalfHour() {
  const date = new Date();
  date.setSeconds(0, 0);
  const minutes = date.getMinutes();
  date.setMinutes(minutes < 30 ? 30 : 60);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function shortDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(
    new Date(year, month - 1, day),
  );
}

function dayName(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
    .format(new Date(year, month - 1, day))
    .replace('.', '');
}

function normalize(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function phoneDigits(value?: string | null) {
  return String(value ?? '').replace(/\D/g, '');
}

function appointmentLabel(date: string, time: string) {
  return `${shortDate(date)} às ${time} · pendente de confirmação`;
}

function parseAppointment(note?: string | null) {
  const match = String(note ?? '').match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?.{0,12}?(\d{1,2}):(\d{2})/i);
  if (!match) return null;
  const now = new Date();
  let year = Number(match[3] || now.getFullYear());
  if (year < 100) year += 2000;
  const month = Number(match[2]);
  const day = Number(match[1]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (!year || !month || !day || hour > 23 || minute > 59) return null;
  return {
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

async function request<T>(path: string, deviceId: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  let body = init?.body;
  if (method !== 'GET' && method !== 'HEAD') {
    const raw = typeof body === 'string' && body ? (JSON.parse(body) as Record<string, unknown>) : {};
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

function statusTone(lead: LeadRow) {
  if (lead.outcome === 'Efetivado' || lead.status === 'Agendado Sistema') return 'green';
  if (lead.status === 'Não tem interesse' || lead.status === 'Número incorreto') return 'red';
  if (lead.appointment_note && lead.status === 'Aguardando') return 'yellow';
  return 'white';
}

function mobileStatus(lead: LeadRow) {
  if (lead.outcome === 'Efetivado') return 'Efetivado';
  if (lead.status === 'Agendado Sistema') return 'Agendado';
  if (lead.status === 'Não tem interesse') return 'Sem interesse';
  if (lead.status === 'Número incorreto') return 'Número incorreto';
  if (lead.appointment_note && lead.status === 'Aguardando') return 'Pendente de agendamento';
  if (lead.status === 'Aguardando') return 'Aguardando contato';
  return lead.status || 'Novo';
}

function pickInitialDate(actions: ActionRow[]) {
  if (!actions.length) return localDateKey();
  const today = localDateKey();
  if (actions.some((action) => action.date === today)) return today;
  const pastOrToday = actions
    .map((action) => action.date)
    .filter((date) => date <= today)
    .sort((a, b) => b.localeCompare(a))[0];
  if (pastOrToday) return pastOrToday;
  return actions.map((action) => action.date).sort((a, b) => a.localeCompare(b))[0];
}

function Sheet({ children, onClose, title, eyebrow }: { children: React.ReactNode; onClose: () => void; title: string; eyebrow: string }) {
  return (
    <div className="street-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="street-sheet" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="street-sheet-grabber" />
        <header className="street-sheet-head">
          <div>
            <span>{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

export default function StreetMobileControl() {
  const deviceIdRef = useRef(getDeviceId());
  const deviceId = deviceIdRef.current;
  const [data, setData] = useState<Bootstrap>(EMPTY);
  const [presence, setPresence] = useState<PresenceRow[]>([]);
  const [selfEmoji, setSelfEmoji] = useState('👤');
  const [selectedDate, setSelectedDate] = useState(localDateKey());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [scheduleLead, setScheduleLead] = useState<LeadRow | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await request<Bootstrap>('/bootstrap', deviceId);
      setData(next);
      setSelectedDate((current) => next.actions.some((action) => action.date === current) ? current : pickInitialDate(next.actions));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao carregar o controle.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [deviceId]);

  const heartbeat = useCallback(async (label = 'Modo rua') => {
    try {
      const result = await request<PresenceEnvelope>('/presence', deviceId, {
        method: 'POST',
        body: JSON.stringify({ activity: 'street', activity_label: label, entity_type: 'street_mobile' }),
      });
      setPresence(result.people || []);
      if (result.self?.avatar_code) setSelfEmoji(result.self.avatar_code);
    } catch {
      // Presence never blocks field work.
    }
  }, [deviceId]);

  useEffect(() => {
    void Promise.all([load(), heartbeat('Em ação externa')]);
    const dataTimer = window.setInterval(() => void load(true), 20_000);
    const presenceTimer = window.setInterval(() => void heartbeat('Em ação externa'), 12_000);
    return () => {
      window.clearInterval(dataTimer);
      window.clearInterval(presenceTimer);
    };
  }, [heartbeat, load]);

  useEffect(() => {
    if (newOpen) void heartbeat('Cadastrando avaliação');
    else if (scheduleLead) void heartbeat(`Definindo horário de ${scheduleLead.name}`);
  }, [heartbeat, newOpen, scheduleLead]);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  }

  const dates = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const action of data.actions) grouped.set(action.date, grouped.get(action.date) || 0);
    for (const lead of data.leads) {
      const action = data.actions.find((item) => item.id === lead.action_id);
      if (action) grouped.set(action.date, (grouped.get(action.date) || 0) + 1);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [data.actions, data.leads]);

  const actionsForDay = useMemo(() => data.actions.filter((action) => action.date === selectedDate), [data.actions, selectedDate]);
  const actionIds = useMemo(() => new Set(actionsForDay.map((action) => action.id)), [actionsForDay]);
  const leadsForDay = useMemo(() => data.leads.filter((lead) => actionIds.has(lead.action_id)), [actionIds, data.leads]);
  const visibleLeads = useMemo(() => {
    const needle = normalize(query);
    return leadsForDay
      .filter((lead) => !needle || normalize(`${lead.name} ${lead.phone_raw} ${lead.captured_by} ${lead.status} ${lead.appointment_note}`).includes(needle))
      .sort((a, b) => Number(Boolean(b.appointment_note)) - Number(Boolean(a.appointment_note)) || (b.updated_at || '').localeCompare(a.updated_at || ''));
  }, [leadsForDay, query]);

  const pendingCount = leadsForDay.filter((lead) => lead.status === 'Aguardando' && Boolean(lead.appointment_note)).length;
  const scheduledCount = leadsForDay.filter((lead) => lead.status === 'Agendado Sistema').length;
  const activeAction = actionsForDay[0] || null;

  async function saveNew(payload: Record<string, unknown>) {
    try {
      const created = await request<LeadRow>('/leads', deviceId, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setData((current) => ({ ...current, leads: [created, ...current.leads], auditCount: current.auditCount + 1 }));
      setNewOpen(false);
      flash('Avaliação salva como pendente.');
      navigator.vibrate?.(35);
      void heartbeat(`Cadastrou ${created.name}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar.');
    }
  }

  async function saveSchedule(lead: LeadRow, date: string, time: string) {
    const appointment_note = appointmentLabel(date, time);
    const previous = lead;
    setData((current) => ({
      ...current,
      leads: current.leads.map((item) => item.id === lead.id ? { ...item, appointment_note, status: 'Aguardando' } : item),
    }));
    try {
      const updated = await request<LeadRow>(`/leads/${lead.id}`, deviceId, {
        method: 'PATCH',
        body: JSON.stringify({ appointment_note, status: 'Aguardando', scheduled_by: null }),
      });
      setData((current) => ({ ...current, leads: current.leads.map((item) => item.id === lead.id ? updated : item) }));
      setScheduleLead(null);
      flash('Horário salvo como pendente.');
      navigator.vibrate?.(35);
      void heartbeat(`Atualizou ${lead.name}`);
    } catch (reason) {
      setData((current) => ({ ...current, leads: current.leads.map((item) => item.id === lead.id ? previous : item) }));
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o horário.');
    }
  }

  return (
    <main className="street-app">
      <header className="street-topbar">
        <div>
          <span className="street-kicker">Controle de Gestão</span>
          <h1>Modo rua</h1>
        </div>
        <div className="street-online" title="Operação compartilhada em tempo real">
          <span className="street-self-avatar">{selfEmoji}<i /></span>
          <span><b>{presence.length || 1}</b> online</span>
        </div>
      </header>

      <section className="street-day-strip" aria-label="Dias de ação">
        {dates.map(([date, count]) => (
          <button
            type="button"
            key={date}
            className={selectedDate === date ? 'active' : ''}
            onClick={() => {
              setSelectedDate(date);
              setQuery('');
            }}
          >
            <span>{dayName(date)}</span>
            <b>{shortDate(date)}</b>
            <small>{count}</small>
          </button>
        ))}
      </section>

      <section className="street-context">
        <div className="street-context-copy">
          <span><MapPin size={14} /> {activeAction?.location || 'Ação externa'}</span>
          <h2>{shortDate(selectedDate)}</h2>
          <small>{leadsForDay.length} contatos · {pendingCount} pendentes · {scheduledCount} agendados</small>
        </div>
        <button type="button" className="street-refresh" onClick={() => void load(true)} aria-label="Atualizar" disabled={refreshing}>
          <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
        </button>
      </section>

      <section className="street-search-wrap">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar nome ou telefone"
          inputMode="search"
          enterKeyHint="search"
          aria-label="Buscar registros"
        />
        {query ? <button type="button" onClick={() => setQuery('')} aria-label="Limpar busca"><X size={17} /></button> : null}
      </section>

      {error ? <div className="street-error" role="alert">{error}<button type="button" onClick={() => setError('')}><X size={16} /></button></div> : null}
      {notice ? <div className="street-notice" role="status"><Check size={16} /> {notice}</div> : null}

      {loading ? (
        <div className="street-loading"><span /> Carregando ação...</div>
      ) : !activeAction ? (
        <div className="street-empty">
          <CalendarClock size={28} />
          <h3>Nenhuma ação neste dia</h3>
          <p>Abra a visão completa para criar uma nova ação.</p>
          <a href="/?view=desktop">Abrir gestão completa <ChevronRight size={16} /></a>
        </div>
      ) : (
        <section className="street-list" aria-label="Avaliações do dia">
          {visibleLeads.length ? visibleLeads.map((lead) => {
            const tone = statusTone(lead);
            const digits = phoneDigits(lead.phone_raw);
            return (
              <article key={lead.id} className={`street-lead-card tone-${tone}`}>
                <div className="street-lead-main">
                  <div className="street-lead-avatar"><UserRound size={18} /></div>
                  <div className="street-lead-copy">
                    <h3>{lead.name}</h3>
                    <span className="street-status">{mobileStatus(lead)}</span>
                    {lead.appointment_note ? <p><Clock3 size={13} /> {lead.appointment_note}</p> : null}
                    <small>{lead.captured_by ? `Abordado por ${lead.captured_by}` : 'Responsável não informado'}</small>
                  </div>
                </div>
                <div className="street-lead-actions">
                  {digits ? (
                    <a href={`tel:${digits}`} className="street-call" aria-label={`Ligar para ${lead.name}`}><Phone size={17} /> Ligar</a>
                  ) : null}
                  <button type="button" onClick={() => setScheduleLead(lead)}>
                    <CalendarClock size={17} /> {lead.appointment_note ? 'Alterar horário' : 'Marcar horário'}
                  </button>
                </div>
              </article>
            );
          }) : (
            <div className="street-empty compact">
              <UsersRound size={25} />
              <h3>{query ? 'Nenhum resultado' : 'Nenhum contato neste dia'}</h3>
              <p>{query ? 'Tente outro nome ou telefone.' : 'Cadastre a primeira avaliação da ação.'}</p>
            </div>
          )}
        </section>
      )}

      <div className="street-bottom-space" />
      <div className="street-bottom-bar">
        <button type="button" className="street-primary" onClick={() => setNewOpen(true)} disabled={!activeAction}>
          <Plus size={21} /> Nova avaliação
        </button>
        <a href="/?view=desktop" className="street-full-view">Gestão completa</a>
      </div>

      {newOpen && activeAction ? (
        <NewEvaluationSheet
          action={activeAction}
          onClose={() => setNewOpen(false)}
          onSubmit={saveNew}
        />
      ) : null}

      {scheduleLead ? (
        <ScheduleSheet
          lead={scheduleLead}
          onClose={() => setScheduleLead(null)}
          onSave={saveSchedule}
        />
      ) : null}
    </main>
  );
}

function NewEvaluationSheet({
  action,
  onClose,
  onSubmit,
}: {
  action: ActionRow;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [capturedBy, setCapturedBy] = useState(() => {
    try { return localStorage.getItem(CAPTURED_BY_KEY) || ''; } catch { return ''; }
  });
  const [date, setDate] = useState(localDateKey());
  const [time, setTime] = useState(nextHalfHour);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !date || !time || saving) return;
    setSaving(true);
    try {
      const promoter = capturedBy.trim();
      if (promoter) {
        try { localStorage.setItem(CAPTURED_BY_KEY, promoter); } catch { /* no-op */ }
      }
      await onSubmit({
        action_id: action.id,
        name: name.trim(),
        phone_raw: phone.trim() || null,
        captured_by: promoter || null,
        appointment_note: appointmentLabel(date, time),
        status: 'Aguardando',
        scheduled_by: null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet eyebrow="Ação externa" title="Nova avaliação" onClose={onClose}>
      <form className="street-form" onSubmit={submit}>
        <div className="street-form-note yellow">
          <CalendarClock size={18} />
          <span><b>Entrará como pendente</b><small>A equipe interna confirma o agendamento depois.</small></span>
        </div>

        <label>
          <span>Nome da pessoa</span>
          <input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome completo" autoComplete="name" />
        </label>

        <label>
          <span>Telefone</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(42) 99999-9999" inputMode="tel" autoComplete="tel" />
        </label>

        <label>
          <span>Quem abordou</span>
          <input
            value={capturedBy}
            onChange={(event) => setCapturedBy(event.target.value)}
            placeholder="Digite o nome"
            autoComplete="off"
            enterKeyHint="next"
          />
        </label>

        <div className="street-date-grid">
          <label>
            <span>Data da avaliação</span>
            <input type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label>
            <span>Horário</span>
            <input type="time" required value={time} onChange={(event) => setTime(event.target.value)} />
          </label>
        </div>

        <div className="street-quick-days">
          <button type="button" className={date === localDateKey() ? 'active' : ''} onClick={() => setDate(localDateKey())}>Hoje</button>
          <button type="button" onClick={() => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            setDate(localDateKey(tomorrow));
          }}>Amanhã</button>
        </div>

        <button type="submit" className="street-save" disabled={saving || !name.trim()}>
          {saving ? <><RefreshCw size={19} className="spin" /> Salvando...</> : <><Check size={20} /> Salvar pendente</>}
        </button>
      </form>
    </Sheet>
  );
}

function ScheduleSheet({ lead, onClose, onSave }: { lead: LeadRow; onClose: () => void; onSave: (lead: LeadRow, date: string, time: string) => Promise<void> }) {
  const parsed = parseAppointment(lead.appointment_note);
  const [date, setDate] = useState(parsed?.date || localDateKey());
  const [time, setTime] = useState(parsed?.time || nextHalfHour());
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!date || !time || saving) return;
    setSaving(true);
    try {
      await onSave(lead, date, time);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet eyebrow="Pendente de agendamento" title={lead.name} onClose={onClose}>
      <form className="street-form" onSubmit={submit}>
        <div className="street-form-note yellow">
          <Clock3 size={18} />
          <span><b>Defina o horário rapidamente</b><small>O registro continuará pendente até a confirmação interna.</small></span>
        </div>
        <div className="street-date-grid">
          <label>
            <span>Data</span>
            <input type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label>
            <span>Horário</span>
            <input type="time" required value={time} onChange={(event) => setTime(event.target.value)} />
          </label>
        </div>
        <button type="submit" className="street-save" disabled={saving}>
          {saving ? <><RefreshCw size={19} className="spin" /> Salvando...</> : <><Check size={20} /> Salvar horário</>}
        </button>
      </form>
    </Sheet>
  );
}
