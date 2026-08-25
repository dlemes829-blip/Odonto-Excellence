import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
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
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

const CONTROL_API = "https://odonto-excellence-acoes.onrender.com/api/public";
const OPERATOR_KEY = "controle-pessoal-operator";

const STATUS_OPTIONS = [
  "Novo",
  "Aguardando",
  "Enviado mensagem",
  "Agendado Sistema",
  "Não tem interesse",
  "Número incorreto",
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

type Bootstrap = {
  actions: ActionRow[];
  leads: LeadRow[];
  conversions: ConversionRow[];
  teamMembers: string[];
  auditCount: number;
};

const emptyBootstrap: Bootstrap = {
  actions: [],
  leads: [],
  conversions: [],
  teamMembers: [],
  auditCount: 0,
};

function money(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(parsed) ? parsed : 0);
}

function dateLabel(value?: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("pt-BR").format(new Date(year, month - 1, day));
}

function dateTimeLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${CONTROL_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "Não foi possível concluir a operação.");
  return body;
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
}) {
  return (
    <article className="pc-metric">
      <span className="pc-metric-icon"><Icon size={17} /></span>
      <span className="pc-metric-label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Modal({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="pc-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="pc-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="pc-modal-head">
          <div>
            <span className="pc-eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <button type="button" className="pc-icon-button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export default function PublicControl() {
  const [data, setData] = useState<Bootstrap>(emptyBootstrap);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"leads" | "conversions">("leads");
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [operator, setOperator] = useState(() => localStorage.getItem(OPERATOR_KEY) || "");
  const [editingLead, setEditingLead] = useState<LeadRow | null>(null);
  const [historyLead, setHistoryLead] = useState<LeadRow | null>(null);
  const [history, setHistory] = useState<AuditRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showNewLead, setShowNewLead] = useState(false);
  const [showNewAction, setShowNewAction] = useState(false);
  const [showNewConversion, setShowNewConversion] = useState(false);

  async function load(silent = false) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      setData(await api<Bootstrap>("/bootstrap"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar o controle.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void load(true), 45_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (operator.trim()) localStorage.setItem(OPERATOR_KEY, operator.trim());
    else localStorage.removeItem(OPERATOR_KEY);
  }, [operator]);

  function actor() {
    return operator.trim() || "Equipe";
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }

  const actionById = useMemo(
    () => new Map(data.actions.map((action) => [action.id, action])),
    [data.actions],
  );

  const statuses = useMemo(
    () => Array.from(new Set(data.leads.map((lead) => lead.status).filter(Boolean))).sort(),
    [data.leads],
  );

  const filteredLeads = useMemo(() => {
    const needle = normalizeSearch(query);
    return data.leads.filter((lead) => {
      if (actionFilter !== "all" && lead.action_id !== actionFilter) return false;
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (!needle) return true;
      return normalizeSearch(
        [
          lead.name,
          lead.phone_raw,
          lead.captured_by,
          lead.scheduled_by,
          lead.appointment_note,
          lead.status,
          lead.outcome,
        ].join(" "),
      ).includes(needle);
    });
  }, [actionFilter, data.leads, query, statusFilter]);

  const totalConversionsValue = useMemo(
    () => data.conversions.reduce((sum, item) => sum + Number(item.value || 0), 0),
    [data.conversions],
  );

  const scheduled = data.leads.filter((lead) => lead.status === "Agendado Sistema").length;
  const waiting = data.leads.filter((lead) => !lead.status || ["Novo", "Aguardando"].includes(lead.status)).length;
  const effective = data.leads.filter((lead) => lead.outcome === "Efetivado").length;

  async function quickStatus(lead: LeadRow, status: string) {
    try {
      await api(`/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, actor: actor() }),
      });
      setData((current) => ({
        ...current,
        leads: current.leads.map((item) => (item.id === lead.id ? { ...item, status } : item)),
        auditCount: current.auditCount + 1,
      }));
      flash(`Status de ${lead.name} atualizado.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar.");
    }
  }

  async function openHistory(lead: LeadRow) {
    setHistoryLead(lead);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const result = await api<{ history: AuditRow[] }>(`/leads/${lead.id}/history`);
      setHistory(result.history || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível abrir o histórico.");
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <main className="pc-root">
      <header className="pc-header">
        <a href="/" className="pc-brand" aria-label="Controle Pessoal">
          <span className="pc-brand-mark">C</span>
          <span><b>Controle Pessoal</b><small>rotina, captação e conversão</small></span>
        </a>
        <div className="pc-header-actions">
          <a href="/acesso" className="pc-secondary-link">
            Sistema completo <ExternalLink size={14} />
          </a>
          <a href="/acesso" className="pc-primary-link">
            Pedir acesso / entrar <ArrowRight size={14} />
          </a>
        </div>
      </header>

      <section className="pc-hero">
        <div>
          <span className="pc-kicker"><span /> Ambiente aberto da equipe</span>
          <h1>O controle que antes vivia <em>na planilha.</em></h1>
          <p>
            Consulte, atualize e acompanhe as ações em tempo real. Sem login, sem senha e com histórico de alterações para não depender da memória coletiva, esse banco de dados humano notoriamente infalível.
          </p>
        </div>
        <div className="pc-operator-card">
          <span className="pc-eyebrow">Quem está usando agora?</span>
          <label htmlFor="pc-operator">Seu nome</label>
          <div className="pc-operator-input">
            <UserRound size={16} />
            <input
              id="pc-operator"
              value={operator}
              onChange={(event) => setOperator(event.target.value.slice(0, 80))}
              placeholder="Ex.: Daniel"
              autoComplete="name"
            />
          </div>
          <small>Não é login. O nome serve somente para identificar alterações no histórico.</small>
        </div>
      </section>

      <section className="pc-dashboard">
        <div className="pc-metrics">
          <Metric label="Leads" value={String(data.leads.length)} detail={`${data.actions.length} ações registradas`} icon={UsersRound} />
          <Metric label="Agendados" value={String(scheduled)} detail="status Agendado Sistema" icon={CalendarDays} />
          <Metric label="Efetivados" value={String(effective)} detail={`${waiting} aguardando próximo passo`} icon={CheckCircle2} />
          <Metric label="Conversões" value={money(totalConversionsValue)} detail={`${data.conversions.length} registros financeiros`} icon={TrendingUp} />
        </div>

        <div className="pc-toolbar-shell">
          <div className="pc-tabs" role="tablist" aria-label="Áreas do controle">
            <button type="button" className={tab === "leads" ? "active" : ""} onClick={() => setTab("leads")}>
              <Activity size={15} /> Ações & leads
            </button>
            <button type="button" className={tab === "conversions" ? "active" : ""} onClick={() => setTab("conversions")}>
              <BarChart3 size={15} /> Conversões
            </button>
          </div>
          <button type="button" className="pc-refresh" onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? "pc-spin" : ""} />
            {refreshing ? "Atualizando" : "Atualizar"}
          </button>
        </div>

        {error ? <div className="pc-alert pc-alert-error">{error}<button type="button" onClick={() => setError("")}><X size={14} /></button></div> : null}
        {notice ? <div className="pc-alert pc-alert-success"><CheckCircle2 size={15} /> {notice}</div> : null}

        {loading ? (
          <section className="pc-loading"><span className="pc-loader" /><b>Carregando controle compartilhado...</b></section>
        ) : tab === "leads" ? (
          <>
            <section className="pc-controls">
              <label className="pc-search">
                <Search size={16} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, telefone, responsável ou observação" />
              </label>
              <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} aria-label="Filtrar por ação">
                <option value="all">Todas as ações</option>
                {data.actions.map((action) => <option key={action.id} value={action.id}>{dateLabel(action.date)} · {action.location || action.name}</option>)}
              </select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar por status">
                <option value="all">Todos os status</option>
                {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <div className="pc-control-actions">
                <button type="button" className="pc-button secondary" onClick={() => setShowNewAction(true)}><MapPin size={14} /> Nova ação</button>
                <button type="button" className="pc-button primary" onClick={() => setShowNewLead(true)}><Plus size={14} /> Novo lead</button>
              </div>
            </section>

            <section className="pc-table-card">
              <header className="pc-table-title">
                <div>
                  <span className="pc-eyebrow">Visão operacional</span>
                  <h2>{filteredLeads.length} registros visíveis</h2>
                </div>
                <span className="pc-audit-pill"><History size={13} /> {data.auditCount} alterações auditadas</span>
              </header>
              <div className="pc-table-scroll">
                <table className="pc-table">
                  <thead><tr><th>#</th><th>Nome</th><th>Telefone</th><th>Captado por</th><th>Ação</th><th>Status</th><th>Agendamento / observação</th><th>Resultado</th><th>Ações</th></tr></thead>
                  <tbody>
                    {filteredLeads.map((lead) => {
                      const action = actionById.get(lead.action_id);
                      return (
                        <tr key={lead.id}>
                          <td className="pc-num">{lead.sheet_number ?? lead.id}</td>
                          <td><b>{lead.name}</b></td>
                          <td className="pc-nowrap">{lead.phone_raw || "—"}</td>
                          <td>{lead.captured_by || "—"}</td>
                          <td><span className="pc-action-date">{dateLabel(action?.date || lead.action_date)}</span><small>{action?.location || "—"}</small></td>
                          <td>
                            <select className="pc-status-select" value={lead.status || "Novo"} onChange={(event) => void quickStatus(lead, event.target.value)}>
                              {Array.from(new Set([...STATUS_OPTIONS, lead.status].filter(Boolean))).map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                          </td>
                          <td className="pc-note"><span>{lead.appointment_note || "—"}</span><small>{lead.scheduled_by ? `Responsável: ${lead.scheduled_by}` : ""}</small></td>
                          <td><span className={lead.outcome === "Efetivado" ? "pc-outcome ok" : "pc-outcome"}>{lead.outcome || "Pendente"}</span>{lead.value ? <small>{money(lead.value)}</small> : null}</td>
                          <td><div className="pc-row-actions"><button type="button" onClick={() => setEditingLead(lead)} aria-label={`Editar ${lead.name}`}><Pencil size={14} /></button><button type="button" onClick={() => void openHistory(lead)} aria-label={`Histórico de ${lead.name}`}><FileClock size={14} /></button></div></td>
                        </tr>
                      );
                    })}
                    {filteredLeads.length === 0 ? <tr><td colSpan={9} className="pc-empty">Nenhum registro corresponde aos filtros.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <section className="pc-table-card">
            <header className="pc-table-title">
              <div><span className="pc-eyebrow">Financeiro comercial</span><h2>Conversões e bonificações</h2></div>
              <button type="button" className="pc-button primary" onClick={() => setShowNewConversion(true)}><Plus size={14} /> Nova conversão</button>
            </header>
            <div className="pc-table-scroll">
              <table className="pc-table pc-conversion-table">
                <thead><tr><th>Paciente</th><th>Data</th><th>Origem</th><th>Agendado por</th><th>Efetivado por</th><th>Valor</th><th>Bonificação</th></tr></thead>
                <tbody>
                  {data.conversions.map((item) => (
                    <tr key={item.id}>
                      <td><b>{item.name}</b></td><td>{dateLabel(item.effective_date)}</td><td>{item.tool || "—"}</td><td>{item.scheduled_by || "—"}</td><td>{item.converted_by || "—"}</td><td><b>{money(item.value)}</b></td><td>{money(item.bonus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>

      <footer className="pc-footer">
        <span>Controle Pessoal · dados compartilhados em tempo real</span>
        <a href="/acesso">Acessar área administrativa <ArrowRight size={13} /></a>
      </footer>

      {showNewLead ? (
        <LeadFormModal
          actions={data.actions}
          members={data.teamMembers}
          actor={actor()}
          onClose={() => setShowNewLead(false)}
          onSaved={() => { setShowNewLead(false); void load(true); flash("Lead adicionado ao controle."); }}
        />
      ) : null}
      {editingLead ? (
        <LeadEditModal
          lead={editingLead}
          actions={data.actions}
          members={data.teamMembers}
          actor={actor()}
          onClose={() => setEditingLead(null)}
          onSaved={() => { setEditingLead(null); void load(true); flash("Registro atualizado."); }}
        />
      ) : null}
      {showNewAction ? <ActionModal actor={actor()} onClose={() => setShowNewAction(false)} onSaved={() => { setShowNewAction(false); void load(true); flash("Nova ação criada."); }} /> : null}
      {showNewConversion ? <ConversionModal members={data.teamMembers} actor={actor()} onClose={() => setShowNewConversion(false)} onSaved={() => { setShowNewConversion(false); void load(true); flash("Conversão registrada."); }} /> : null}
      {historyLead ? (
        <Modal title={`Histórico · ${historyLead.name}`} eyebrow="Trilha de alterações" onClose={() => setHistoryLead(null)}>
          <div className="pc-history-list">
            {historyLoading ? <div className="pc-modal-loading"><span className="pc-loader" /> Carregando histórico...</div> : history.length ? history.map((entry) => (
              <article key={entry.id} className="pc-history-item">
                <span className="pc-history-dot" />
                <div><b>{entry.event === "create" ? "Registro criado" : "Registro atualizado"}</b><small>{entry.actor_name} · {dateTimeLabel(entry.created_at)}</small></div>
              </article>
            )) : <div className="pc-empty">Ainda não há alterações registradas para este lead.</div>}
          </div>
        </Modal>
      ) : null}
    </main>
  );
}

function LeadFormModal({ actions, members, actor, onClose, onSaved }: { actions: ActionRow[]; members: string[]; actor: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ action_id: actions[0]?.id || "", name: "", phone_raw: "", captured_by: actor === "Equipe" ? "" : actor, status: "Novo", scheduled_by: "", appointment_note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await api("/leads", { method: "POST", body: JSON.stringify({ ...form, actor }) }); onSaved(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar."); setBusy(false); }
  }
  return <Modal title="Adicionar lead" eyebrow="Captação" onClose={onClose}><form className="pc-form" onSubmit={submit}>
    <label>Ação<select value={form.action_id} onChange={(e) => setForm({ ...form, action_id: e.target.value })} required>{actions.map((action) => <option key={action.id} value={action.id}>{dateLabel(action.date)} · {action.location || action.name}</option>)}</select></label>
    <div className="pc-form-grid"><label>Nome<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus /></label><label>Telefone<input value={form.phone_raw} onChange={(e) => setForm({ ...form, phone_raw: e.target.value })} /></label></div>
    <div className="pc-form-grid"><label>Captado por<input list="pc-members-new" value={form.captured_by} onChange={(e) => setForm({ ...form, captured_by: e.target.value })} /></label><label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select></label></div>
    <label>Responsável / agendamento<input list="pc-members-new" value={form.scheduled_by} onChange={(e) => setForm({ ...form, scheduled_by: e.target.value })} /></label>
    <label>Observação<textarea rows={3} value={form.appointment_note} onChange={(e) => setForm({ ...form, appointment_note: e.target.value })} /></label>
    <datalist id="pc-members-new">{members.map((member) => <option key={member} value={member} />)}</datalist>
    {error ? <p className="pc-form-error">{error}</p> : null}<div className="pc-form-actions"><button type="button" className="pc-button secondary" onClick={onClose}>Cancelar</button><button className="pc-button primary" disabled={busy}>{busy ? "Salvando..." : "Salvar lead"}</button></div>
  </form></Modal>;
}

function LeadEditModal({ lead, actions, members, actor, onClose, onSaved }: { lead: LeadRow; actions: ActionRow[]; members: string[]; actor: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ action_id: lead.action_id, name: lead.name, phone_raw: lead.phone_raw || "", captured_by: lead.captured_by || "", status: lead.status || "Novo", scheduled_by: lead.scheduled_by || "", appointment_note: lead.appointment_note || "", outcome: lead.outcome || "", outcome_date: lead.outcome_date || "", value: lead.value == null ? "" : String(lead.value) });
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { await api(`/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ ...form, actor }) }); onSaved(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar."); setBusy(false); } }
  return <Modal title={`Editar · ${lead.name}`} eyebrow="Registro operacional" onClose={onClose}><form className="pc-form" onSubmit={submit}>
    <label>Ação<select value={form.action_id} onChange={(e) => setForm({ ...form, action_id: e.target.value })}>{actions.map((action) => <option key={action.id} value={action.id}>{dateLabel(action.date)} · {action.location || action.name}</option>)}</select></label>
    <div className="pc-form-grid"><label>Nome<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label>Telefone<input value={form.phone_raw} onChange={(e) => setForm({ ...form, phone_raw: e.target.value })} /></label></div>
    <div className="pc-form-grid"><label>Captado por<input list="pc-members-edit" value={form.captured_by} onChange={(e) => setForm({ ...form, captured_by: e.target.value })} /></label><label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Array.from(new Set([...STATUS_OPTIONS, form.status].filter(Boolean))).map((status) => <option key={status}>{status}</option>)}</select></label></div>
    <label>Responsável / agendamento<input list="pc-members-edit" value={form.scheduled_by} onChange={(e) => setForm({ ...form, scheduled_by: e.target.value })} /></label>
    <label>Observação<textarea rows={3} value={form.appointment_note} onChange={(e) => setForm({ ...form, appointment_note: e.target.value })} /></label>
    <div className="pc-form-grid"><label>Resultado<select value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })}><option value="">Pendente</option><option value="Efetivado">Efetivado</option><option value="Não efetivado">Não efetivado</option></select></label><label>Data do resultado<input type="date" value={form.outcome_date} onChange={(e) => setForm({ ...form, outcome_date: e.target.value })} /></label></div>
    <label>Valor<input type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></label>
    <datalist id="pc-members-edit">{members.map((member) => <option key={member} value={member} />)}</datalist>
    {error ? <p className="pc-form-error">{error}</p> : null}<div className="pc-form-actions"><button type="button" className="pc-button secondary" onClick={onClose}>Cancelar</button><button className="pc-button primary" disabled={busy}>{busy ? "Salvando..." : "Salvar alterações"}</button></div>
  </form></Modal>;
}

function ActionModal({ actor, onClose, onSaved }: { actor: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), location: "São Francisco", name: "" }); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { await api("/actions", { method: "POST", body: JSON.stringify({ ...form, actor }) }); onSaved(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível criar a ação."); setBusy(false); } }
  return <Modal title="Criar nova ação" eyebrow="Organização" onClose={onClose}><form className="pc-form" onSubmit={submit}><div className="pc-form-grid"><label>Data<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label><label>Local<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required /></label></div><label>Nome da ação <small>(opcional)</small><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Ação Centro" /></label>{error ? <p className="pc-form-error">{error}</p> : null}<div className="pc-form-actions"><button type="button" className="pc-button secondary" onClick={onClose}>Cancelar</button><button className="pc-button primary" disabled={busy}>{busy ? "Criando..." : "Criar ação"}</button></div></form></Modal>;
}

function ConversionModal({ members, actor, onClose, onSaved }: { members: string[]; actor: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", effective_date: new Date().toISOString().slice(0, 10), value: "", tool: "Conversão", scheduled_by: "", converted_by: "", bonus: "50" }); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { await api("/conversions", { method: "POST", body: JSON.stringify({ ...form, actor }) }); onSaved(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível registrar a conversão."); setBusy(false); } }
  return <Modal title="Registrar conversão" eyebrow="Resultado comercial" onClose={onClose}><form className="pc-form" onSubmit={submit}><label>Paciente<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus /></label><div className="pc-form-grid"><label>Data<input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} /></label><label>Origem<select value={form.tool} onChange={(e) => setForm({ ...form, tool: e.target.value })}><option>Conversão</option><option>Amigo do Peito</option><option>Outro</option></select></label></div><div className="pc-form-grid"><label>Agendado por<input list="pc-members-conv" value={form.scheduled_by} onChange={(e) => setForm({ ...form, scheduled_by: e.target.value })} /></label><label>Efetivado por<input list="pc-members-conv" value={form.converted_by} onChange={(e) => setForm({ ...form, converted_by: e.target.value })} /></label></div><div className="pc-form-grid"><label>Valor<input type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></label><label>Bonificação<input type="number" min="0" step="0.01" value={form.bonus} onChange={(e) => setForm({ ...form, bonus: e.target.value })} /></label></div><datalist id="pc-members-conv">{members.map((member) => <option key={member} value={member} />)}</datalist>{error ? <p className="pc-form-error">{error}</p> : null}<div className="pc-form-actions"><button type="button" className="pc-button secondary" onClick={onClose}>Cancelar</button><button className="pc-button primary" disabled={busy}>{busy ? "Salvando..." : "Registrar conversão"}</button></div></form></Modal>;
}
