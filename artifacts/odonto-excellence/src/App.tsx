import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useRoute } from 'wouter';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BarChart3, Bell, CalendarDays, Check,
  CheckCircle2, ChevronRight, CircleHelp, Clock3, ExternalLink, FileClock,
  GraduationCap, Home, LayoutDashboard, MapPin, Menu, MessageCircle,
  MoreHorizontal, Pencil, Phone, Play, Plus, RotateCcw, Save, Settings2,
  ShieldCheck, Sparkles, Stethoscope, Trash2, TrendingUp, UserRound, UsersRound,
  Video, Volume2, VolumeX, X, Zap
} from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

/* ─── TYPES ─── */
type Gender = 'feminine' | 'masculine' | 'neutral';
type AppStatus = 'confirmed' | 'pending' | 'rescheduled';
type Appointment = { id: string; patient: string; date: string; time: string; note: string; status: AppStatus };
type Collaborator = { id: string; name: string; role: string; gender: Gender; goal: number; calls: number; messages: number; whatsapp: number; conversions: number; appointments: Appointment[] };
type DayArchive = { id: string; date: string; closedAt: string; appointments: Appointment[]; collaboratorName: string; collaborators: Collaborator[] };
type Training = { id: string; title: string; duration: string; watched: boolean; attempts: number; area: string };
type Store = { collaborators: Collaborator[]; archives: DayArchive[]; training: Training[]; activeId: string; activeDate: string; soundEnabled: boolean };

/* ─── HELPERS ─── */
function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
const today = localDateKey();
function initials(name: string) { return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase(); }
function formatDate(value: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`)).replace('.', ''); }
function formatWeekday(value: string) { return new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(new Date(`${value}T12:00:00`)); }
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }
function genderTone(g: Gender) { return g === 'feminine' ? 'hsl(340 60% 80%)' : g === 'masculine' ? 'hsl(210 55% 78%)' : 'hsl(38 70% 78%)'; }

/* ─── WEB AUDIO NOTIFICATION ─── */
let audioCtx: AudioContext | null = null;
function playNotificationSound(kind: 'success' | 'alert' = 'success') {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    const ctx = audioCtx;
    const sequences = {
      success: [
        { freq: 523.25, start: 0, dur: 0.08 },
        { freq: 659.25, start: 0.1, dur: 0.08 },
        { freq: 783.99, start: 0.2, dur: 0.14 },
      ],
      alert: [
        { freq: 880, start: 0, dur: 0.12 },
        { freq: 698.46, start: 0.15, dur: 0.12 },
        { freq: 880, start: 0.32, dur: 0.18 },
      ],
    };
    for (const { freq, start, dur } of sequences[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.02);
    }
  } catch { /* silent if audio not available */ }
}

/* ─── SEED DATA ─── */
const initialCollaborators: Collaborator[] = [
  { id: 'daniel', name: 'Daniel', role: 'Gestor de relacionamento', gender: 'masculine', goal: 18, calls: 21, messages: 28, whatsapp: 34, conversions: 8, appointments: [
    { id: 'a1', patient: 'Marina Silveira', date: today, time: '08:30', note: 'Avaliação inicial · retorno pelo WhatsApp', status: 'confirmed' },
    { id: 'a2', patient: 'Otávio Mendes', date: today, time: '10:00', note: 'Limpeza e revisão semestral', status: 'confirmed' },
    { id: 'a3', patient: 'Bianca Lopes', date: today, time: '14:30', note: 'Confirmar documentação do plano', status: 'pending' },
  ] },
  { id: 'will', name: 'Will', role: 'Consultor comercial', gender: 'masculine', goal: 15, calls: 16, messages: 22, whatsapp: 29, conversions: 6, appointments: [
    { id: 'a4', patient: 'Catarina Alves', date: today, time: '09:00', note: 'Apresentar plano de tratamento', status: 'confirmed' },
    { id: 'a5', patient: 'Pedro Nunes', date: today, time: '13:00', note: 'Lembrete de consulta', status: 'rescheduled' },
  ] },
  { id: 'chaline', name: 'Chaline', role: 'Experiência do paciente', gender: 'feminine', goal: 20, calls: 25, messages: 31, whatsapp: 41, conversions: 11, appointments: [
    { id: 'a6', patient: 'Rafael Costa', date: today, time: '11:30', note: 'Paciente novo · primeira visita', status: 'confirmed' },
    { id: 'a7', patient: 'Elisa Rocha', date: today, time: '15:30', note: 'Pós-operatório', status: 'confirmed' },
  ] },
  { id: 'queizy', name: 'Queizy', role: 'Relacionamento', gender: 'feminine', goal: 16, calls: 19, messages: 26, whatsapp: 30, conversions: 7, appointments: [
    { id: 'a8', patient: 'Gustavo Freitas', date: today, time: '16:00', note: 'Retorno de orçamento', status: 'pending' },
  ] },
  { id: 'mayssa', name: 'Mayssa', role: 'Consultora comercial', gender: 'feminine', goal: 14, calls: 12, messages: 20, whatsapp: 24, conversions: 5, appointments: [
    { id: 'a9', patient: 'Lívia Duarte', date: today, time: '08:00', note: 'Ortodontia · alinhadores', status: 'confirmed' },
    { id: 'a10', patient: 'Caio Martins', date: today, time: '17:00', note: 'Confirmar forma de pagamento', status: 'pending' },
  ] },
  { id: 'sara', name: 'Sara', role: 'Secretária clínica', gender: 'feminine', goal: 17, calls: 18, messages: 24, whatsapp: 36, conversions: 9, appointments: [
    { id: 'a11', patient: 'João Vicente', date: today, time: '09:30', note: 'Agendamento de retorno', status: 'confirmed' },
    { id: 'a12', patient: 'Sofia Ramos', date: today, time: '12:00', note: 'Atualizar cadastro', status: 'confirmed' },
  ] },
];
const initialTraining: Training[] = [
  { id: 't1', title: 'Acolhimento que gera confiança', duration: '08:42', watched: true, attempts: 1, area: 'Experiência' },
  { id: 't2', title: 'Como conduzir uma avaliação', duration: '12:18', watched: true, attempts: 2, area: 'Comercial' },
  { id: 't3', title: 'Follow-up sem perder o timing', duration: '06:34', watched: false, attempts: 4, area: 'Relacionamento' },
  { id: 't4', title: 'Organizando uma agenda saudável', duration: '10:05', watched: true, attempts: 1, area: 'Gestão' },
  { id: 't5', title: 'O cuidado depois da consulta', duration: '07:51', watched: false, attempts: 3, area: 'Experiência' },
  { id: 't6', title: 'Conversas que destravam decisões', duration: '14:20', watched: false, attempts: 5, area: 'Comercial' },
];

/* ─── STORE ─── */
function readStore(): Store {
  try {
    const saved = localStorage.getItem('odonto-excellence-v2');
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<Store>;
      const colabs = parsed.collaborators ?? initialCollaborators;
      const storedDate = parsed.activeDate ?? today;
      const archives = parsed.archives ?? [];
      if (storedDate !== today) {
        const hasData = colabs.some((p) => p.appointments.length > 0 || p.calls > 0 || p.messages > 0 || p.conversions > 0);
        const rollover: DayArchive = {
          id: `archive-auto-${storedDate}`, date: storedDate, closedAt: 'virada automática',
          appointments: colabs.flatMap((p) => p.appointments.map((a) => ({ ...a }))),
          collaboratorName: 'Equipe Odonto Excellence',
          collaborators: colabs.map((p) => ({ ...p, appointments: [...p.appointments] })),
        };
        return {
          collaborators: colabs.map((p) => ({ ...p, calls: 0, messages: 0, whatsapp: 0, conversions: 0, appointments: [] })),
          archives: hasData ? [rollover, ...archives] : archives,
          training: parsed.training ?? initialTraining,
          activeId: parsed.activeId ?? colabs[0]?.id ?? 'daniel',
          activeDate: today,
          soundEnabled: parsed.soundEnabled ?? true,
        };
      }
      return { collaborators: colabs, archives, training: parsed.training ?? initialTraining, activeId: parsed.activeId ?? colabs[0]?.id ?? 'daniel', activeDate: today, soundEnabled: parsed.soundEnabled ?? true };
    }
  } catch { /* use seed */ }
  return { collaborators: initialCollaborators, archives: [], training: initialTraining, activeId: 'daniel', activeDate: today, soundEnabled: true };
}

/* ─── BRAND LOGO ─── */
function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className={`brand-lockup ${dark ? 'brand-lockup-dark' : ''}`}>
      <span className="brand-logo-frame">
        <img src="/clinic/odonto-excellence-logo.png" alt="Odonto Excellence" className="brand-logo" />
      </span>
      <span className="brand-clinic-label">
        <span>PALHOÇA · SC</span>
        <small>GESTÃO CLÍNICA</small>
      </span>
    </Link>
  );
}

/* ─── BACK TO MENU BUTTON ─── */
function BackToMenu({ label = 'Menu principal' }: { label?: string }) {
  const [, setLocation] = useLocation();
  return (
    <button onClick={() => setLocation('/painel')} className="btn-menu">
      <Home size={14} /> {label}
    </button>
  );
}

/* ─── SIDEBAR ─── */
function Sidebar({ activeId, soundEnabled, onToggleSound, onClose }: {
  activeId: string; soundEnabled: boolean; onToggleSound: () => void; onClose: () => void;
}) {
  const [location] = useLocation();
  const navItems = [
    { href: '/painel', label: 'Visão geral', icon: LayoutDashboard },
    { href: `/colaborador/${activeId}`, label: 'Minha jornada', icon: UserRound },
    { href: '/historico', label: 'Dias fechados', icon: FileClock },
    { href: '/treinamento', label: 'Treinamento', icon: GraduationCap },
    { href: '/configuracoes', label: 'Configurações', icon: Settings2 },
  ];
  return (
    <aside className="sidebar">
      <div className="brand flex items-center justify-between">
        <Brand dark />
        <button onClick={onClose} className="button-ghost button-icon text-white/60 md:hidden" aria-label="Fechar menu"><X size={17} /></button>
      </div>
      <div className="nav-section">
        <div className="nav-label">Operação</div>
        <nav className="space-y-1">
          {navItems.slice(0, 3).map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={onClose}
              className={`nav-item ${location === href || (href.includes('/colaborador') && location.startsWith('/colaborador')) ? 'active' : ''}`}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
      <div className="nav-section">
        <div className="nav-label">Desenvolvimento</div>
        <nav className="space-y-1">
          {navItems.slice(3).map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={onClose}
              className={`nav-item ${location === href ? 'active' : ''}`}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
      <div className="mt-auto space-y-3">
        <button
          onClick={onToggleSound}
          className={`nav-item w-full text-left gap-3 ${soundEnabled ? 'text-[hsl(var(--sidebar-primary))]' : 'opacity-50'}`}
          title={soundEnabled ? 'Desativar som' : 'Ativar som'}>
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          <span className="text-xs">{soundEnabled ? 'Som ativo' : 'Som desativado'}</span>
        </button>
        <div className="panel p-3 !bg-white/5 !border-white/10">
          <div className="flex gap-2 text-xs text-white/80"><ShieldCheck size={16} className="text-[hsl(var(--sidebar-primary))] shrink-0" /><span>Dados locais · este dispositivo.</span></div>
        </div>
      </div>
    </aside>
  );
}

function MobileNav({ activeId }: { activeId: string }) {
  const [location] = useLocation();
  return (
    <div className="mobile-menu">
      {([
        ['/painel', 'Painel', LayoutDashboard],
        [`/colaborador/${activeId}`, 'Jornada', UserRound],
        ['/historico', 'Histórico', FileClock],
        ['/treinamento', 'Treino', GraduationCap],
      ] as [string, string, typeof Home][]).map(([href, label, Icon]) => (
        <Link key={href} href={href}
          className={`nav-item ${location === href || (href.includes('/colaborador') && location.startsWith('/colaborador')) ? 'active' : ''}`}>
          <Icon size={14} /><span>{label}</span>
        </Link>
      ))}
    </div>
  );
}

/* ─── NOTIFICATION BELL ─── */
function NotifBell({ count }: { count: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (count > 0 && ref.current) {
      ref.current.classList.remove('ring-bell');
      void ref.current.offsetWidth;
      ref.current.classList.add('ring-bell');
    }
  }, [count]);
  return (
    <span className="relative inline-flex">
      <span ref={ref}><Bell size={18} /></span>
      {count > 0 && <span className="notif-badge">{count > 9 ? '9+' : count}</span>}
    </span>
  );
}

/* ─── APP SHELL ─── */
function AppShell({ children, store, onToggleSound }: {
  children: React.ReactNode; store: Store; onToggleSound: () => void;
}) {
  const active = store.collaborators.find((p) => p.id === store.activeId) ?? store.collaborators[0];
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, setLocation] = useLocation();
  const pendingCount = store.collaborators.flatMap((p) => p.appointments).filter((a) => a.status === 'pending').length;

  return (
    <div className="app-shell shell-bg">
      <div className="hidden md:block">
        <Sidebar activeId={active?.id ?? 'daniel'} soundEnabled={store.soundEnabled} onToggleSound={onToggleSound} onClose={() => undefined} />
      </div>
      <div className="main-area">
        <header className="topbar">
          <button className="button-ghost button-icon md:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button>
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-mono font-bold">PONTE DO IMARUIM</span>
            <span className="opacity-30 mx-1">/</span>
            <span>Palhoça, SC</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <button className="button-ghost button-icon relative" aria-label="Notificações" onClick={() => setLocation('/painel')}>
              <NotifBell count={pendingCount} />
            </button>
            <Link href={`/colaborador/${active?.id}`} className="flex items-center gap-2">
              <span className="avatar w-8 h-8" style={{ background: genderTone(active?.gender ?? 'neutral') }}>{initials(active?.name ?? 'OE')}</span>
              <span className="hidden sm:block text-xs font-bold">{active?.name}</span>
            </Link>
          </div>
        </header>
        <div className="md:hidden px-4 pt-1"><MobileNav activeId={active?.id ?? 'daniel'} /></div>
        {children}
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 md:hidden bg-[rgba(30,4,4,.42)]" onClick={() => setMobileOpen(false)}>
          <div className="w-[82%] max-w-[300px] h-full" onClick={(e) => e.stopPropagation()}>
            <Sidebar activeId={active?.id ?? 'daniel'} soundEnabled={store.soundEnabled} onToggleSound={onToggleSound} onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── TOAST ─── */
type ToastKind = 'success' | 'notify';
interface ToastMsg { id: number; message: string; kind: ToastKind }
function Toast({ msg, onClose }: { msg: ToastMsg; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3800); return () => clearTimeout(t); }, [msg.id, onClose]);
  const Icon = msg.kind === 'notify' ? Bell : CheckCircle2;
  return (
    <div className={`toast-note toast-${msg.kind} flex items-center gap-3`}>
      <Icon size={16} className={msg.kind === 'notify' ? 'text-[hsl(38,90%,54%)]' : 'text-[hsl(var(--sidebar-primary))]'} />
      <span>{msg.message}</span>
    </div>
  );
}

/* ─── STAT CARD ─── */
function StatCard({ label, value, detail, icon: Icon, accent = false }: {
  label: string; value: string; detail: string; icon: typeof CalendarDays; accent?: boolean;
}) {
  return (
    <div className="panel p-4 md:p-5">
      <div className="flex justify-between gap-2">
        <span className="text-[11px] text-muted-foreground font-bold leading-tight uppercase tracking-wide">{label}</span>
        <Icon size={16} className={accent ? 'text-accent' : 'text-primary'} />
      </div>
      <div className="stat-value mt-5">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-2">{detail}</div>
    </div>
  );
}

/* ─── EMPTY STATE ─── */
function EmptyState({ icon: Icon, title, copy, action, onAction }: {
  icon: typeof CalendarDays; title: string; copy: string; action?: string; onAction?: () => void;
}) {
  return (
    <div className="p-10 text-center">
      <span className="w-12 h-12 rounded-2xl bg-muted text-primary grid place-items-center mx-auto"><Icon size={21} /></span>
      <h3 className="font-bold mt-4">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-2 leading-relaxed">{copy}</p>
      {action && onAction && (
        <button onClick={onAction} className="button-primary mt-5">{action} <ArrowRight size={13} /></button>
      )}
    </div>
  );
}

/* ─── CLOSE DAY MODAL ─── */
function CloseDayModal({ count, onCancel, onConfirm }: { count: number; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card p-7">
        <div className="flex justify-between">
          <span className="w-11 h-11 rounded-xl bg-primary/10 text-primary grid place-items-center"><CheckCircle2 size={21} /></span>
          <button onClick={onCancel} className="button-ghost button-icon" aria-label="Cancelar"><X size={17} /></button>
        </div>
        <h2 className="display-title text-3xl mt-6">Fechar o dia com calma?</h2>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          Vamos arquivar <strong>{count} {count === 1 ? 'encontro' : 'encontros'}</strong> de hoje e limpar as filas para o próximo dia. O histórico continua disponível em Dias fechados.
        </p>
        <div className="flex justify-end gap-2 mt-8">
          <button className="button-secondary" onClick={onCancel}>Ainda não</button>
          <button className="button-primary" onClick={onConfirm}><Check size={15} /> Arquivar e limpar</button>
        </div>
      </div>
    </div>
  );
}

/* ─── APPOINTMENT MODAL ─── */
function AppointmentModal({ appointment, onCancel, onSave }: {
  appointment: Appointment | null; onCancel: () => void; onSave: (a: Appointment) => void;
}) {
  const [form, setForm] = useState<Appointment>(
    appointment ?? { id: `a-${Date.now()}`, patient: '', date: today, time: '09:00', note: '', status: 'pending' }
  );
  const upd = (k: keyof Appointment, v: string) => setForm({ ...form, [k]: v } as Appointment);
  return (
    <div className="modal-backdrop">
      <form className="modal-card p-7" onSubmit={(e) => { e.preventDefault(); if (form.patient.trim()) onSave(form); }}>
        <div className="flex justify-between items-start">
          <div>
            <div className="eyebrow">{appointment ? 'Editar' : 'Novo encontro'}</div>
            <h2 className="display-title text-3xl mt-2">{appointment ? 'Ajustar encontro' : 'Adicionar encontro'}</h2>
          </div>
          <button type="button" onClick={onCancel} className="button-ghost button-icon" aria-label="Fechar"><X size={17} /></button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mt-7">
          <label className="sm:col-span-2">
            <span className="label-text">Nome do paciente *</span>
            <input required value={form.patient} onChange={(e) => upd('patient', e.target.value)} className="input-field" placeholder="Ex.: Ana Beatriz" autoFocus />
          </label>
          <label>
            <span className="label-text">Data</span>
            <input type="date" value={form.date} onChange={(e) => upd('date', e.target.value)} className="input-field" />
          </label>
          <label>
            <span className="label-text">Horário</span>
            <input type="time" value={form.time} onChange={(e) => upd('time', e.target.value)} className="input-field" />
          </label>
          <label>
            <span className="label-text">Status</span>
            <select value={form.status} onChange={(e) => upd('status', e.target.value)} className="select-field">
              <option value="pending">⏳ Aguardando</option>
              <option value="confirmed">✅ Confirmado</option>
              <option value="rescheduled">🔄 Reagendar</option>
            </select>
          </label>
          <label className="sm:col-span-1">
            <span className="label-text">Nota rápida</span>
            <textarea value={form.note} onChange={(e) => upd('note', e.target.value)} rows={2} className="textarea-field resize-none" placeholder="O que a equipe precisa saber?" />
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" className="button-secondary" onClick={onCancel}>Cancelar</button>
          <button type="submit" className="button-primary"><Save size={15} /> Salvar encontro</button>
        </div>
      </form>
    </div>
  );
}

/* ─── TEAM PULSE ─── */
function TeamPulse({ store, onOpen }: { store: Store; onOpen: (id: string) => void }) {
  return (
    <section className="panel p-5">
      <div className="eyebrow">Pulso do time</div>
      <h2 className="font-bold text-lg mt-2">Cada pessoa, seu movimento.</h2>
      <div className="space-y-4 mt-5">
        {store.collaborators.map((p) => {
          const pct = Math.min(100, Math.round((p.conversions / p.goal) * 100));
          const fillClass = pct >= 80 ? '' : pct >= 50 ? 'progress-fill-gold' : 'progress-fill';
          return (
            <button key={p.id} onClick={() => onOpen(p.id)} className="w-full text-left group">
              <div className="flex items-center gap-3">
                <span className="avatar w-8 h-8" style={{ background: genderTone(p.gender) }}>{initials(p.name)}</span>
                <span className="text-xs font-bold flex-1">{p.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{p.conversions}/{p.goal}</span>
                <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="progress-track mt-2 ml-11">
                <div className={`progress-fill ${fillClass}`} style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ─── TRAINING SNAPSHOT ─── */
function TrainingSnapshot({ training, onOpen }: { training: Training[]; onOpen: () => void }) {
  const watched = training.filter((t) => t.watched).length;
  const pct = Math.round((watched / training.length) * 100);
  return (
    <section className="panel p-5">
      <div className="flex justify-between items-start">
        <div>
          <div className="eyebrow">Treinamento</div>
          <h2 className="font-bold text-lg mt-2">Aprender também é operar.</h2>
        </div>
        <button className="button-ghost button-icon" onClick={onOpen} aria-label="Abrir treinamento"><ArrowRight size={16} /></button>
      </div>
      <div className="flex items-center gap-7 mt-7">
        <div className="metric-ring" style={{ '--pct': `${pct}%` } as React.CSSProperties}>
          <div className="metric-ring-content"><b className="text-2xl">{pct}%</b><span className="text-[9px] block text-muted-foreground">concluído</span></div>
        </div>
        <div>
          <div className="text-sm font-bold">{watched} de {training.length} aulas</div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">10 minutos de preparo<br />mudam a próxima conversa.</p>
          <button className="text-xs text-primary font-bold mt-3 hover:underline" onClick={onOpen}>Continuar trilha <ArrowRight size={12} className="inline" /></button>
        </div>
      </div>
    </section>
  );
}

/* ─── PRIORITY ITEM ─── */
function Priority({ icon: Icon, title, detail, tone }: { icon: typeof Zap; title: string; detail: string; tone: 'coral' | 'red' | 'gold' }) {
  const cls = tone === 'coral' ? 'bg-accent/15 text-accent' : tone === 'red' ? 'bg-primary/10 text-primary' : 'bg-[hsl(38,90%,54%)]/20 text-[hsl(38,70%,42%)]';
  return (
    <div className="flex gap-3 items-center">
      <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${cls}`}><Icon size={16} /></span>
      <div><div className="text-xs font-bold">{title}</div><div className="text-[10px] text-muted-foreground mt-1">{detail}</div></div>
    </div>
  );
}

/* ─── ACTIVITY PANEL ─── */
function ActivityPanel({ person, updatePerson, notify }: {
  person: Collaborator; updatePerson: (p: Collaborator) => void; notify: (m: string, k?: ToastKind) => void;
}) {
  const fields: { key: 'calls' | 'messages' | 'whatsapp' | 'conversions'; label: string; icon: typeof Phone }[] = [
    { key: 'calls', label: 'Ligações', icon: Phone },
    { key: 'messages', label: 'Mensagens', icon: MessageCircle },
    { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { key: 'conversions', label: 'Conversões', icon: TrendingUp },
  ];
  return (
    <section className="panel p-5">
      <div className="eyebrow">Atividade comercial</div>
      <h2 className="font-bold text-lg mt-2">O que você movimentou.</h2>
      <p className="text-xs text-muted-foreground mt-2">Toque no número para ajustar.</p>
      <div className="space-y-3 mt-6">
        {fields.map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary grid place-items-center"><Icon size={14} /></span>
            <span className="text-xs font-bold flex-1">{label}</span>
            <input
              type="number" min="0" value={person[key]}
              onChange={(e) => updatePerson({ ...person, [key]: Number(e.target.value) })}
              onBlur={() => notify('Atividade salva.')}
              className="input-field !w-16 !px-2 text-center font-mono text-xs"
            />
          </div>
        ))}
      </div>
      <div className="border-t border-border mt-6 pt-5">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-muted-foreground">Meta do período</span>
          <b className="text-primary">{Math.round((person.conversions / person.goal) * 100)}%</b>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${Math.min(100, (person.conversions / person.goal) * 100)}%` }} />
        </div>
      </div>
    </section>
  );
}

/* ─── PROFILE MODAL ─── */
function ProfileModal({ onCancel, onSave }: { onCancel: () => void; onSave: (p: Collaborator) => void }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [gender, setGender] = useState<Gender>('neutral');
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ id: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`, name: name.trim(), role: role.trim() || 'Equipe clínica', gender, goal: 15, calls: 0, messages: 0, whatsapp: 0, conversions: 0, appointments: [] });
  };
  return (
    <div className="modal-backdrop">
      <form className="modal-card p-7" onSubmit={save}>
        <div className="flex justify-between items-start">
          <div><div className="eyebrow">Equipe</div><h2 className="display-title text-3xl mt-2">Novo perfil.</h2></div>
          <button type="button" onClick={onCancel} className="button-ghost button-icon"><X size={17} /></button>
        </div>
        <label className="block mt-7">
          <span className="label-text">Nome *</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="Ex.: Helena" autoFocus />
        </label>
        <label className="block mt-4">
          <span className="label-text">Função na clínica</span>
          <input value={role} onChange={(e) => setRole(e.target.value)} className="input-field" placeholder="Ex.: Recepção" />
        </label>
        <fieldset className="mt-5">
          <legend className="label-text">Apresentação do avatar</legend>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {([['feminine', 'Feminina'], ['masculine', 'Masculino'], ['neutral', 'Neutro/Prefiro não dizer']] as [Gender, string][]).map(([v, lbl]) => (
              <label key={v} className={`rounded-xl border p-3 text-center text-[11px] font-bold cursor-pointer transition-colors ${gender === v ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                <input type="radio" name="gender" value={v} checked={gender === v} onChange={() => setGender(v)} className="sr-only" />
                <span className="avatar w-8 h-8 mx-auto mb-2 block" style={{ background: genderTone(v) }}>{initials(name || 'OE')}</span>
                <span className="block leading-tight">{lbl}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2 mt-7">
          <button type="button" className="button-secondary" onClick={onCancel}>Cancelar</button>
          <button type="submit" className="button-primary"><Save size={15} /> Criar perfil</button>
        </div>
      </form>
    </div>
  );
}

/* ─── FEATURE CARD ─── */
function Feature({ icon: Icon, title, copy }: { icon: typeof CalendarDays; title: string; copy: string }) {
  return (
    <div className="landing-card p-5 hover:-translate-y-1 transition-transform duration-200">
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center"><Icon size={18} /></div>
      <h3 className="font-bold text-sm mt-4">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed mt-2">{copy}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PAGES
══════════════════════════════════════════════════════════ */

/* ─── LANDING ─── */
function Landing() {
  const [, setLocation] = useLocation();
  return (
    <main className="min-h-dvh">
      {/* NAV */}
      <nav className="landing-nav sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border">
        <Brand />
        <div className="flex items-center gap-4">
          <a href="#ritmo" className="hidden sm:block text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">A clínica</a>
          <a href="#fotos" className="hidden sm:block text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">Fotos</a>
          <Link href="/acesso" className="button-primary">Entrar no sistema <ArrowRight size={14} /></Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="section-pad pt-14 md:pt-20">
        <div className="hero-grid max-w-[1320px] mx-auto">
          <div>
            <div className="eyebrow flex items-center gap-2"><span className="w-8 h-px bg-primary" />Ponte do Imaruim · Palhoça, SC</div>
            <h1 className="display-title text-[clamp(50px,7.5vw,104px)] leading-[.85] mt-6 max-w-[820px]">
              Cuidar bem<br /><em className="text-primary">começa</em><br />na chegada.
            </h1>
            <p className="max-w-[500px] mt-8 text-base md:text-lg leading-relaxed text-muted-foreground">
              Uma clínica feita para receber você com calma, tecnologia e atenção — do primeiro sorriso na recepção ao último detalhe do seu tratamento.
            </p>
            <div className="flex flex-wrap gap-3 mt-9">
              <button onClick={() => setLocation('/acesso')} className="button-primary px-6 py-3 text-sm">
                Começar o dia <ArrowRight size={16} />
              </button>
              <a href="https://www.google.com/maps/dir/?api=1&destination=R.+Antônio+Viêira,+415,+Palhoça,+SC" target="_blank" rel="noreferrer" className="button-secondary px-5">
                <MapPin size={15} /> Como chegar
              </a>
            </div>
            <div className="flex items-center gap-4 mt-12 text-xs text-muted-foreground">
              <div className="flex -space-x-2">
                {initialCollaborators.slice(0, 4).map((p) => (
                  <span key={p.id} className="avatar w-8 h-8 border-2 border-background" style={{ background: genderTone(p.gender) }}>{initials(p.name)}</span>
                ))}
              </div>
              <span>Equipe conectada para fazer<br /><b className="text-foreground">o cuidado acontecer.</b></span>
            </div>
          </div>
          {/* HERO VISUAL */}
          <div className="hero-orbit">
            <img src="/clinic/palhoca-reception.png" alt="Recepção da Odonto Excellence Ponte do Imaruim" className="hero-clinic-photo" />
            <div className="hero-photo-shade" />
            <div className="absolute top-7 right-7 flex items-center gap-2 text-[10px] text-white/65 font-mono">
              <span className="w-2 h-2 rounded-full bg-[hsl(var(--sidebar-primary))] animate-pulse" />SISTEMA ATIVO
            </div>
            <div className="absolute top-[22%] right-[16%] w-20 h-20 rounded-full border border-white/25 bg-white/12 backdrop-blur-sm grid place-items-center">
              <Stethoscope size={26} className="text-white/80" />
            </div>
            <div className="orbit-copy">
              <div className="eyebrow !text-[hsl(var(--sidebar-primary))]">Clareza para o time</div>
              <p className="display-title text-4xl md:text-5xl mt-3">Seu sorriso<br />está em boas mãos.</p>
              <div className="flex gap-3 mt-7">
                <span className="chip !bg-white/12 !text-white/85">Ponte do Imaruim</span>
                <span className="chip !bg-white/12 !text-white/85">4.8 no Google</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="ritmo" className="section-pad bg-secondary/20 mt-4">
        <div className="max-w-[1180px] mx-auto grid md:grid-cols-[.8fr_1.2fr] gap-10 items-start">
          <div>
            <div className="eyebrow">O ritmo da clínica</div>
            <h2 className="display-title text-5xl mt-4 leading-[.92]">Menos ruído.<br /><span className="text-primary">Mais presença.</span></h2>
            <p className="mt-5 text-sm text-muted-foreground leading-relaxed max-w-sm">Uma experiência acolhedora, organizada e próxima para você cuidar do sorriso sem deixar a rotina de lado.</p>
            <div className="trust-strip mt-7">
              <span className="trust-dot" />
              <span><strong>Unidade Ponte do Imaruim</strong><br />Atendimento local em Palhoça</span>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Feature icon={CalendarDays} title="Agenda que respira" copy="Acompanhe consultas, retornos e reagendamentos sem perder o fio da conversa." />
            <Feature icon={TrendingUp} title="Metas com contexto" copy="Veja o que avançou hoje e qual é o próximo movimento, sem pressão vazia." />
            <Feature icon={Bell} title="Notificações em tempo real" copy="Som e alerta imediatos quando um novo agendamento é criado — para toda a equipe." />
            <Feature icon={GraduationCap} title="Aprendizado vivo" copy="Treinamentos acompanhados no mesmo lugar em que a operação acontece." />
          </div>
        </div>
      </section>

      {/* FOTOS REAIS */}
      <section id="fotos" className="section-pad">
        <div className="max-w-[1180px] mx-auto">
          <div className="eyebrow text-center">Estrutura da clínica</div>
          <h2 className="display-title text-4xl md:text-5xl text-center mt-3">
              Um espaço que<br /><span className="text-primary">recebe você.</span>
          </h2>
           <p className="text-center text-sm text-muted-foreground mt-4 max-w-md mx-auto">Conheça a unidade Odonto Excellence Ponte do Imaruim antes de chegar.</p>
          <div className="grid md:grid-cols-3 gap-4 mt-10">
            {[
               { url: '/clinic/palhoca-reception.png', caption: 'Recepção · Ponte do Imaruim', position: 'center' },
               { url: '/clinic/palhoca-facade.png', caption: 'Identidade da unidade', position: 'center 58%' },
               { url: '/clinic/palhoca-maps-gallery.png', caption: 'Odonto Excellence · Palhoça', position: 'center' },
             ].map(({ url, caption, position }) => (
              <div key={url} className="landing-card overflow-hidden" style={{ aspectRatio: '16/10', position: 'relative' }}>
                 <img src={url} alt={caption} className="clinic-photo" style={{ objectPosition: position }} loading="lazy" />
                <div className="photo-caption">{caption}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center text-xs text-muted-foreground">
             Imagens da unidade de Ponte do Imaruim · Palhoça, SC
          </div>
        </div>
      </section>

      {/* BRAND + MAP */}
      <section className="section-pad pt-0">
        <div className="max-w-[1180px] mx-auto landing-card overflow-hidden grid md:grid-cols-[.9fr_1.1fr] items-stretch">
          <div className="p-7 md:p-10">
            <div className="eyebrow">Imagem institucional</div>
            <h2 className="display-title text-4xl mt-3">Uma marca forte.<br /><span className="text-primary">Um cuidado próximo.</span></h2>
            <p className="text-sm text-muted-foreground mt-4 leading-relaxed">A unidade de Ponte do Imaruim combina a experiência da rede Odonto Excellence com uma equipe que conhece e cuida da comunidade de Palhoça.</p>
            <a href="https://www.odontoexcellence.com.br/" target="_blank" rel="noreferrer" className="button-secondary mt-6 inline-flex">Conhecer a rede <ExternalLink size={14} /></a>
          </div>
          <div className="min-h-[250px] bg-[#3b0a0a] overflow-hidden">
            <img src="/clinic/palhoca-maps-gallery.png" alt="Identidade visual da Odonto Excellence" className="w-full h-full object-cover opacity-90" />
          </div>
        </div>
      </section>

      {/* LOCATION */}
      <section className="section-pad pt-0">
        <div className="max-w-[1180px] mx-auto landing-card p-7 md:p-12 grid md:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <div className="eyebrow">Onde estamos</div>
            <h2 className="display-title text-4xl md:text-5xl mt-3">Cuidado perto de casa.</h2>
            <p className="text-sm text-muted-foreground mt-3">R. Antônio Viêira, 415 · Ponte do Imaruim<br />Palhoça · SC · 88130-470</p>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary/60" />4.8★ no Google Maps</p>
          </div>
          <a href="https://www.google.com/maps/dir/?api=1&destination=R.+Antônio+Viêira,+415,+Palhoça,+SC" target="_blank" rel="noreferrer" className="button-primary px-6">
            Abrir no Maps <ExternalLink size={14} />
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-[7vw] py-8 border-t border-border flex flex-col sm:flex-row justify-between gap-3 text-[11px] text-muted-foreground">
        <span>© {new Date().getFullYear()} Odonto Excellence · Gestão Clínica · Ponte do Imaruim</span>
        <span>Dados ficam somente neste dispositivo.</span>
      </footer>
    </main>
  );
}

/* ─── ACCESS PAGE ─── */
function Access({ store, setStore }: { store: Store; setStore: (s: Store) => void }) {
  const [, setLocation] = useLocation();
  return (
    <main className="min-h-dvh grid lg:grid-cols-[.85fr_1.15fr]">
      <section className="bg-sidebar text-sidebar-foreground p-8 md:p-12 flex flex-col">
        <Brand dark />
        <div className="mt-auto max-w-md pb-8">
          <div className="eyebrow !text-[hsl(var(--sidebar-primary))]">Acesso local</div>
          <h1 className="display-title text-6xl mt-4 leading-[.87]">Quem está<br />conduzindo<br /><span className="text-[hsl(var(--sidebar-primary))]">hoje?</span></h1>
          <p className="text-sm text-white/55 mt-7 leading-relaxed">Escolha seu perfil para abrir sua fila de consultas, metas e prioridades. Não é um login — os dados ficam somente neste dispositivo.</p>
          <div className="mt-8 flex gap-2 text-[10px] text-white/40"><ShieldCheck size={14} /> Privacidade por design · uso local</div>
        </div>
        <div className="text-xs text-white/35">Ponte do Imaruim · Palhoça, SC</div>
      </section>
      <section className="p-6 md:p-12 lg:p-20 bg-background">
        <div className="max-w-xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={14} /> Voltar para o início
          </Link>
          <div className="mt-14">
            <div className="eyebrow">Perfis da equipe</div>
            <h2 className="display-title text-4xl mt-3">Escolha seu espaço.</h2>
            <p className="text-sm text-muted-foreground mt-3">Você pode trocar de perfil a qualquer momento nas configurações.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-9">
            {store.collaborators.map((p) => (
              <button
                key={p.id}
                className="panel p-4 text-left flex items-center gap-3 hover:-translate-y-1 hover:border-primary/30 transition-all duration-200"
                onClick={() => { setStore({ ...store, activeId: p.id }); setLocation('/painel'); }}>
                <span className="avatar w-11 h-11" style={{ background: genderTone(p.gender) }}>{initials(p.name)}</span>
                <span className="min-w-0">
                  <b className="block text-sm">{p.name}</b>
                  <span className="block text-[11px] text-muted-foreground truncate mt-1">{p.role}</span>
                </span>
                <ChevronRight size={15} className="ml-auto text-muted-foreground" />
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-8 flex gap-2 items-start">
            <CircleHelp size={14} className="shrink-0 mt-0.5" /> Perfil novo? A coordenação pode criar em Configurações.
          </p>
        </div>
      </section>
    </main>
  );
}

/* ─── DASHBOARD ─── */
function Dashboard({ store, setStore, notify }: {
  store: Store; setStore: (s: Store) => void; notify: (m: string, k?: ToastKind) => void;
}) {
  const [showClose, setShowClose] = useState(false);
  const [, setLocation] = useLocation();
  const allAppts = store.collaborators
    .flatMap((p) => p.appointments.map((a) => ({ ...a, collaborator: p.name, collaboratorId: p.id, gender: p.gender })))
    .filter((a) => a.date === today)
    .sort((a, b) => a.time.localeCompare(b.time));
  const totalGoal = store.collaborators.reduce((s, p) => s + p.goal, 0);
  const totalConv = store.collaborators.reduce((s, p) => s + p.conversions, 0);
  const totalActivity = store.collaborators.reduce((s, p) => s + p.calls + p.messages + p.whatsapp, 0);

  function closeDay() {
    const archive: DayArchive = {
      id: `archive-${Date.now()}`, date: today, closedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      appointments: allAppts, collaboratorName: 'Equipe Odonto Excellence',
      collaborators: store.collaborators.map((p) => ({ ...p, appointments: [...p.appointments] })),
    };
    setStore({
      ...store, activeDate: today, archives: [archive, ...store.archives],
      collaborators: store.collaborators.map((p) => ({ ...p, appointments: [], calls: 0, messages: 0, whatsapp: 0, conversions: 0 })),
    });
    setShowClose(false);
    notify('Dia arquivado. Amanhã começa limpo.');
  }

  const pendingCount = allAppts.filter((a) => a.status === 'pending').length;

  return (
    <AppShell store={store} onToggleSound={() => setStore({ ...store, soundEnabled: !store.soundEnabled })}>
      <div className="content-wrap">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <div className="eyebrow">{formatDate(today)} · {formatWeekday(today)}</div>
            <h1 className="page-title mt-3">{greeting()}, equipe.</h1>
            <p className="text-sm text-muted-foreground mt-3">Aqui está o pulso da clínica. Um passo de cada vez.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button-secondary" onClick={() => setLocation('/colaborador/' + store.activeId)}>
              <UserRound size={15} /> Minha fila
            </button>
            <button className="button-primary" onClick={() => setShowClose(true)}>
              <Check size={15} /> Fechar o dia
            </button>
          </div>
        </div>

        {/* ALERT PENDENTES */}
        {pendingCount > 0 && (
          <div className="mt-5 flex items-center gap-3 p-4 rounded-xl bg-[hsl(38,90%,54%)]/12 border border-[hsl(38,90%,54%)]/25">
            <AlertTriangle size={18} className="text-[hsl(38,65%,40%)] shrink-0" />
            <span className="text-sm font-bold text-[hsl(38,55%,32%)]">{pendingCount} {pendingCount === 1 ? 'agendamento aguarda' : 'agendamentos aguardam'} confirmação</span>
          </div>
        )}

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          <StatCard label="Encontros na agenda" value={allAppts.length.toString()} detail={`${allAppts.filter((a) => a.status === 'confirmed').length} confirmados`} icon={CalendarDays} />
          <StatCard label="Meta do time" value={`${Math.round((totalConv / totalGoal) * 100)}%`} detail={`${totalConv} de ${totalGoal} conversões`} icon={TrendingUp} accent />
          <StatCard label="Atividade comercial" value={totalActivity.toString()} detail="contatos registrados hoje" icon={MessageCircle} />
          <StatCard label="Pessoas em movimento" value={store.collaborators.length.toString()} detail="perfis ativos" icon={UsersRound} />
        </div>

        {/* AGENDA + PULSE */}
        <div className="grid xl:grid-cols-[1.5fr_.8fr] gap-5 mt-5">
          <section className="panel overflow-hidden">
            <div className="p-5 flex justify-between items-start">
              <div>
                <div className="eyebrow">Agenda compartilhada</div>
                <h2 className="font-bold text-lg mt-2">Hoje na clínica</h2>
              </div>
              <span className="chip chip-red chip-live"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> ao vivo</span>
            </div>
            {allAppts.length ? (
              <div className="table-wrap">
                <div className="table-row table-head bg-muted/40">
                  <span>Paciente</span><span>Horário</span><span>Responsável</span><span>Observação</span><span>Status</span>
                </div>
                {allAppts.map((a) => (
                  <div className="table-row hover:bg-muted/30 transition-colors" key={a.id}>
                    <div className="flex items-center gap-2">
                      <span className="avatar w-8 h-8 text-[9px]" style={{ background: genderTone(a.gender) }}>{initials(a.patient)}</span>
                      <span className="font-bold text-xs">{a.patient}</span>
                    </div>
                    <span className="font-mono text-xs text-primary font-bold">{a.time}</span>
                    <button onClick={() => setLocation(`/colaborador/${a.collaboratorId}`)} className="text-left text-xs font-bold hover:text-primary transition-colors">
                      {a.collaborator}
                    </button>
                    <span className="text-[11px] text-muted-foreground truncate">{a.note}</span>
                    <span className={`chip ${a.status === 'confirmed' ? 'chip-red' : a.status === 'rescheduled' ? 'chip-coral' : ''}`}>
                      {a.status === 'confirmed' ? 'confirmado' : a.status === 'rescheduled' ? 'reagendar' : 'aguardando'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={CalendarDays} title="Agenda em branco" copy="O fechamento de ontem limpou a fila. Adicione o primeiro encontro do dia." action="Abrir minha fila" onAction={() => setLocation(`/colaborador/${store.activeId}`)} />
            )}
          </section>
          <TeamPulse store={store} onOpen={(id) => setLocation(`/colaborador/${id}`)} />
        </div>

        {/* TRAINING + PRIORITIES */}
        <div className="grid lg:grid-cols-2 gap-5 mt-5">
          <TrainingSnapshot training={store.training} onOpen={() => setLocation('/treinamento')} />
          <section className="panel p-5">
            <div className="eyebrow">Uma pausa para olhar</div>
            <h2 className="display-title text-3xl mt-2">O que merece<br /><span className="text-primary">atenção agora?</span></h2>
            <div className="space-y-3 mt-5">
              <Priority icon={Zap} title={`${pendingCount > 0 ? pendingCount : '3'} retornos aguardando contato`} detail="Prioridade comercial · agora" tone="coral" />
              <Priority icon={Clock3} title="Pedro Nunes precisa de novo horário" detail="Reagendamento · hoje" tone="red" />
              <Priority icon={GraduationCap} title="2 aulas com mais tentativas" detail="Treinamento · esta semana" tone="gold" />
            </div>
          </section>
        </div>
      </div>
      {showClose && <CloseDayModal count={allAppts.length} onCancel={() => setShowClose(false)} onConfirm={closeDay} />}
    </AppShell>
  );
}

/* ─── COLLABORATOR WORKSPACE ─── */
function CollaboratorWorkspace({ store, setStore, notify }: {
  store: Store; setStore: (s: Store) => void; notify: (m: string, k?: ToastKind) => void;
}) {
  const [, params] = useRoute('/colaborador/:id');
  const id = params?.id ?? store.activeId;
  const person = store.collaborators.find((p) => p.id === id) ?? store.collaborators[0];
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const updatePerson = (updated: Collaborator) => setStore({ ...store, collaborators: store.collaborators.map((p) => p.id === updated.id ? updated : p) });

  function removeAppt(apptId: string) {
    updatePerson({ ...person, appointments: person.appointments.filter((a) => a.id !== apptId) });
    notify('Encontro removido.');
  }

  return (
    <AppShell store={store} onToggleSound={() => setStore({ ...store, soundEnabled: !store.soundEnabled })}>
      <div className="content-wrap">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center gap-5 justify-between">
          <div className="flex items-center gap-4">
            <span className="avatar w-16 h-16 text-lg font-bold" style={{ background: genderTone(person.gender) }}>{initials(person.name)}</span>
            <div>
              <div className="eyebrow">Workspace individual</div>
              <h1 className="page-title mt-1">{person.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">{person.role}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
              <Plus size={15} /> Novo encontro
            </button>
            <BackToMenu />
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
          <StatCard label="Meta do período" value={`${person.conversions}/${person.goal}`} detail={`${Math.round((person.conversions / person.goal) * 100)}% atingido`} icon={TrendingUp} accent />
          <StatCard label="Na agenda" value={`${person.appointments.length}`} detail="encontros em aberto" icon={CalendarDays} />
          <StatCard label="Contatos" value={`${person.calls + person.messages + person.whatsapp}`} detail={`${person.calls} lig. · ${person.whatsapp} WhatsApp`} icon={Phone} />
          <StatCard label="Conversão" value={`${Math.round((person.conversions / Math.max(1, person.calls + person.messages + person.whatsapp)) * 100)}%`} detail="sobre atividades" icon={Zap} />
        </div>

        {/* APPOINTMENTS + ACTIVITY */}
        <div className="grid xl:grid-cols-[1.4fr_.8fr] gap-5 mt-5">
          <section className="panel overflow-hidden">
            <div className="p-5 flex justify-between items-start">
              <div>
                <div className="eyebrow">Fila de hoje</div>
                <h2 className="font-bold text-lg mt-2">Consultas e retornos</h2>
              </div>
              <span className="chip chip-red">{person.appointments.length} itens</span>
            </div>
            {person.appointments.length ? (
              <div className="table-wrap">
                <div className="table-row table-head bg-muted/40">
                  <span>Paciente</span><span>Data / hora</span><span>Status</span><span>Notas</span><span />
                </div>
                {person.appointments.map((a) => (
                  <div className="table-row hover:bg-muted/30 transition-colors" key={a.id}>
                    <div className="flex gap-2 items-center">
                      <span className="avatar w-8 h-8" style={{ background: genderTone(person.gender) }}>{initials(a.patient)}</span>
                      <b className="text-xs">{a.patient}</b>
                    </div>
                    <div>
                      <span className="block font-mono text-[11px] text-primary font-bold">{a.time}</span>
                      <span className="block text-[10px] text-muted-foreground mt-1">{formatDate(a.date)}</span>
                    </div>
                    <button
                      onClick={() => updatePerson({ ...person, appointments: person.appointments.map((item) => item.id === a.id ? { ...item, status: item.status === 'confirmed' ? 'pending' : 'confirmed' } : item) })}
                      className={`chip cursor-pointer hover:opacity-80 transition-opacity ${a.status === 'confirmed' ? 'chip-red' : a.status === 'rescheduled' ? 'chip-coral' : ''}`}>
                      {a.status === 'confirmed' ? '✅ confirmado' : a.status === 'rescheduled' ? '🔄 reagendar' : '⏳ aguardando'}
                    </button>
                    <span className="text-[11px] text-muted-foreground truncate">{a.note || '—'}</span>
                    <div className="flex gap-1 justify-end">
                      <button className="button-ghost button-icon" onClick={() => { setEditing(a); setShowForm(true); }} aria-label={`Editar ${a.patient}`}><Pencil size={14} /></button>
                      <button className="button-ghost button-icon !text-destructive" onClick={() => removeAppt(a.id)} aria-label={`Excluir ${a.patient}`}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={CalendarDays} title="Fila limpa" copy="Adicione consultas, retornos ou reagendamentos para dar forma ao seu dia." action="Adicionar encontro" onAction={() => setShowForm(true)} />
            )}
          </section>
          <ActivityPanel person={person} updatePerson={updatePerson} notify={notify} />
        </div>

        {/* PRIORITIES */}
        <div className="panel p-5 mt-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Próximo movimento</div>
              <h2 className="font-bold text-lg mt-2">Prioridades da jornada</h2>
            </div>
            <span className="chip chip-coral"><Sparkles size={12} /> foco</span>
          </div>
          <div className="grid md:grid-cols-3 gap-3 mt-5">
            <Priority icon={Phone} title={`${Math.max(0, person.goal - person.conversions)} conversões para a meta`} detail="Escolha 1 contato para começar" tone="coral" />
            <Priority icon={MessageCircle} title={`${person.whatsapp} conversas no WhatsApp`} detail="Retome as que ficaram abertas" tone="red" />
            <Priority icon={CalendarDays} title={person.appointments.length ? 'Agenda em movimento' : 'Monte sua primeira agenda'} detail="Atualize sempre que algo mudar" tone="gold" />
          </div>
        </div>
      </div>
      {showForm && (
        <AppointmentModal
          appointment={editing}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onSave={(a) => {
            const next = editing
              ? person.appointments.map((item) => item.id === a.id ? a : item)
              : [...person.appointments, a];
            updatePerson({ ...person, appointments: next.sort((x, y) => `${x.date}${x.time}`.localeCompare(`${y.date}${y.time}`)) });
            setShowForm(false);
            setEditing(null);
            if (!editing) notify(`Novo agendamento: ${a.patient}`, 'notify');
            else notify('Encontro atualizado.');
          }}
        />
      )}
    </AppShell>
  );
}

/* ─── HISTORY ─── */
function History({ store }: { store: Store }) {
  const [selected, setSelected] = useState<DayArchive | null>(null);
  return (
    <AppShell store={store} onToggleSound={() => {}}>
      <div className="content-wrap">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Memória da operação</div>
            <h1 className="page-title mt-3">Dias fechados.</h1>
            <p className="text-sm text-muted-foreground mt-3 max-w-lg">O que foi concluído fica guardado para orientar o próximo passo.</p>
          </div>
          <BackToMenu />
        </div>
        <div className="grid lg:grid-cols-[.9fr_1.1fr] gap-5 mt-9">
          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Arquivo local</h2>
              <span className="chip">{store.archives.length} dias</span>
            </div>
            {store.archives.length ? (
              <div className="space-y-2 mt-5">
                {store.archives.map((arc) => (
                  <button
                    key={arc.id}
                    onClick={() => setSelected(arc)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${selected?.id === arc.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:bg-muted/50'}`}>
                    <div className="flex items-center justify-between">
                      <b className="text-sm">{formatDate(arc.date)}</b>
                      <ChevronRight size={15} className="text-muted-foreground" />
                    </div>
                    <div className="flex gap-3 text-[10px] text-muted-foreground mt-2">
                      <span>{arc.appointments.length} encontros</span>
                      <span>fechado às {arc.closedAt}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState icon={FileClock} title="Ainda não há dias arquivados" copy="Quando a equipe fechar o primeiro dia, o histórico aparecerá aqui." />
            )}
          </section>
          <section className="panel p-5 min-h-[330px]">
            {selected ? (
              <>
                <div className="eyebrow">Detalhes do fechamento</div>
                <h2 className="display-title text-4xl mt-2">{formatDate(selected.date)}</h2>
                <p className="text-xs text-muted-foreground mt-2">Encerrado às {selected.closedAt} · {selected.collaboratorName}</p>
                <div className="space-y-2 mt-7">
                  {selected.appointments.map((a) => (
                    <div className="schedule-tile flex items-center gap-3" key={a.id}>
                      <span className="font-mono text-xs text-primary font-bold">{a.time}</span>
                      <span className="text-xs font-bold flex-1">{a.patient}</span>
                      <span className="text-[10px] text-muted-foreground truncate">{a.note}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState icon={FileClock} title="Selecione um dia" copy="Escolha um fechamento ao lado para revisar os encontros arquivados." />
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

/* ─── TRAINING ─── */
function Training({ store, setStore, notify }: {
  store: Store; setStore: (s: Store) => void; notify: (m: string, k?: ToastKind) => void;
}) {
  const watched = store.training.filter((t) => t.watched).length;
  const highAttempts = store.training.filter((t) => t.attempts >= 4);
  const toggle = (item: Training) => {
    setStore({ ...store, training: store.training.map((t) => t.id === item.id ? { ...t, watched: !t.watched } : t) });
    notify(item.watched ? 'Aula marcada como pendente.' : 'Aula concluída. Boa prática!');
  };
  return (
    <AppShell store={store} onToggleSound={() => setStore({ ...store, soundEnabled: !store.soundEnabled })}>
      <div className="content-wrap">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <div className="eyebrow">Desenvolvimento contínuo</div>
            <h1 className="page-title mt-3">Treinar para cuidar.</h1>
            <p className="text-sm text-muted-foreground mt-3 max-w-lg">Uma trilha pequena, acompanhada e possível — porque consistência faz parte da excelência.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button-primary" onClick={() => { const next = store.training.find((t) => !t.watched); if (next) toggle(next); }}>
              <Play size={15} /> Marcar próxima aula
            </button>
            <BackToMenu />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-9">
          <StatCard label="Aulas totais" value={`${store.training.length}`} detail="na trilha da equipe" icon={Video} />
          <StatCard label="Assistidas" value={`${watched}`} detail={`${Math.round((watched / store.training.length) * 100)}% do total`} icon={CheckCircle2} accent />
          <StatCard label="Restantes" value={`${store.training.length - watched}`} detail="para sua próxima pausa" icon={Clock3} />
          <StatCard label="Dias estudados" value="4" detail="nesta semana" icon={GraduationCap} />
        </div>
        <div className="grid xl:grid-cols-[1.3fr_.7fr] gap-5 mt-5">
          <section className="panel overflow-hidden">
            <div className="p-5">
              <div className="eyebrow">Trilha da equipe</div>
              <h2 className="font-bold text-lg mt-2">Aulas para o dia a dia</h2>
            </div>
            {store.training.map((item) => (
              <div className="flex items-center gap-4 p-4 md:p-5 border-t border-border hover:bg-muted/30 transition-colors" key={item.id}>
                <button
                  onClick={() => toggle(item)}
                  className={`w-9 h-9 rounded-full border grid place-items-center shrink-0 transition-all ${item.watched ? 'bg-primary border-primary text-white' : 'border-input text-transparent hover:text-primary hover:border-primary'}`}
                  aria-label={`${item.watched ? 'Marcar pendente' : 'Concluir'}: ${item.title}`}>
                  <Check size={15} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-bold ${item.watched ? 'line-through text-muted-foreground' : ''}`}>{item.title}</div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                    <span>{item.area}</span><span>{item.duration}</span><span>{item.attempts} tentativas</span>
                  </div>
                </div>
                <button className="button-ghost button-icon" onClick={() => notify(`Abrindo aula: ${item.title}`)} aria-label={`Assistir ${item.title}`}>
                  <Play size={15} />
                </button>
              </div>
            ))}
          </section>
          <section className="panel p-5">
            <div className="eyebrow">Leitura do estudo</div>
            <h2 className="display-title text-3xl mt-2">Seu aprendizado<br /><span className="text-primary">tem um ritmo.</span></h2>
            <div className="mt-8">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-muted-foreground">Progresso geral</span>
                <b className="text-primary">{watched}/{store.training.length}</b>
              </div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${(watched / store.training.length) * 100}%` }} /></div>
            </div>
            <div className="border-t border-border mt-7 pt-5">
              <div className="flex gap-2 items-center"><BarChart3 size={16} className="text-accent" /><b className="text-xs">Para revisitar</b></div>
              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                {highAttempts.length ? `${highAttempts.length} aulas tiveram mais tentativas. Vale voltar sem pressa.` : 'Nenhuma aula exige atenção extra agora.'}
              </p>
              {highAttempts.map((item) => (
                <div key={item.id} className="flex justify-between mt-3 text-xs">
                  <span className="truncate">{item.title}</span>
                  <span className="font-mono text-accent ml-2">{item.attempts}x</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

/* ─── SETTINGS ─── */
function Settings({ store, setStore, notify }: {
  store: Store; setStore: (s: Store) => void; notify: (m: string, k?: ToastKind) => void;
}) {
  const [showProfile, setShowProfile] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  function clearData() {
    localStorage.removeItem('odonto-excellence-v2');
    setStore({ collaborators: initialCollaborators, archives: [], training: initialTraining, activeId: 'daniel', activeDate: today, soundEnabled: true });
    setConfirmReset(false);
    notify('Dados restaurados para o exemplo inicial.');
  }

  return (
    <AppShell store={store} onToggleSound={() => setStore({ ...store, soundEnabled: !store.soundEnabled })}>
      <div className="content-wrap">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Controle do dispositivo</div>
            <h1 className="page-title mt-3">Configurações locais.</h1>
            <p className="text-sm text-muted-foreground mt-3 max-w-lg">Ajuste os perfis e cuide do espaço onde a rotina da clínica vive. Nada é enviado para um servidor.</p>
          </div>
          <BackToMenu />
        </div>

        {/* SOUND SETTING */}
        <section className="panel p-5 md:p-7 mt-9">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex gap-3 items-start">
              <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                {store.soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
              </span>
              <div>
                <h2 className="font-bold text-sm">Notificações com som</h2>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Som ativado para novos agendamentos. A notificação aparece para todos em tempo real.</p>
              </div>
            </div>
            <button
              onClick={() => { setStore({ ...store, soundEnabled: !store.soundEnabled }); notify(store.soundEnabled ? 'Som desativado.' : 'Som ativado!'); }}
              className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${store.soundEnabled ? 'bg-primary text-white' : 'button-secondary'}`}>
              {store.soundEnabled ? '🔔 Som ativo' : '🔕 Som desativado'}
            </button>
          </div>
        </section>

        {/* TEAM */}
        <section className="panel p-5 md:p-7 mt-5">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <div className="eyebrow">Equipe da clínica</div>
              <h2 className="font-bold text-lg mt-2">Perfis ativos</h2>
              <p className="text-xs text-muted-foreground mt-2">A cor de cada avatar acompanha a apresentação escolhida.</p>
            </div>
            <button className="button-primary self-start" onClick={() => setShowProfile(true)}>
              <Plus size={15} /> Novo perfil
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-3 mt-7">
            {store.collaborators.map((p) => (
              <div className="border border-border rounded-xl p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors" key={p.id}>
                <span className="avatar w-10 h-10" style={{ background: genderTone(p.gender) }}>{initials(p.name)}</span>
                <div className="min-w-0 flex-1">
                  <b className="text-sm block">{p.name}</b>
                  <span className="text-[10px] text-muted-foreground">{p.role}</span>
                </div>
                <span className="chip">{p.gender === 'feminine' ? 'feminino' : p.gender === 'masculine' ? 'masculino' : 'neutro'}</span>
              </div>
            ))}
          </div>
        </section>

        {/* DATA */}
        <section className="grid md:grid-cols-2 gap-5 mt-5">
          <div className="panel p-5">
            <div className="flex gap-3">
              <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0"><ShieldCheck size={17} /></span>
              <div>
                <h2 className="font-bold text-sm">Armazenamento local</h2>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">Consultas, metas, histórico e progresso ficam somente no navegador desta clínica.</p>
                <span className="chip chip-red mt-4 inline-flex"><CheckCircle2 size={12} /> sincronização desativada</span>
              </div>
            </div>
          </div>
          <div className="panel p-5">
            <div className="flex gap-3">
              <span className="w-9 h-9 rounded-lg bg-accent/15 text-accent grid place-items-center shrink-0"><RotateCcw size={17} /></span>
              <div>
                <h2 className="font-bold text-sm">Começar de novo</h2>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">Restaure os dados de exemplo para preparar este dispositivo para uma nova rotina.</p>
                <button className="button-danger mt-4" onClick={() => setConfirmReset(true)}>Restaurar dados iniciais</button>
              </div>
            </div>
          </div>
        </section>
      </div>
      {showProfile && (
        <ProfileModal onCancel={() => setShowProfile(false)} onSave={(p) => { setStore({ ...store, collaborators: [...store.collaborators, p] }); setShowProfile(false); notify(`${p.name} entrou para a equipe.`); }} />
      )}
      {confirmReset && (
        <div className="modal-backdrop">
          <div className="modal-card p-7">
            <div className="flex justify-between">
              <span className="w-11 h-11 rounded-xl bg-accent/15 text-accent grid place-items-center"><RotateCcw size={19} /></span>
              <button onClick={() => setConfirmReset(false)} className="button-ghost button-icon"><X size={17} /></button>
            </div>
            <h2 className="display-title text-3xl mt-6">Restaurar dados iniciais?</h2>
            <p className="text-sm text-muted-foreground mt-3">Seu histórico e alterações locais serão removidos deste dispositivo.</p>
            <div className="flex justify-end gap-2 mt-7">
              <button className="button-secondary" onClick={() => setConfirmReset(false)}>Manter meus dados</button>
              <button className="button-danger" onClick={clearData}>Restaurar agora</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

/* ══════════════════════════════════════════════════════════
   APP ROOT
══════════════════════════════════════════════════════════ */
function AppRouter({ store, setStore, notify }: { store: Store; setStore: (s: Store) => void; notify: (m: string, k?: ToastKind) => void }) {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/acesso"><Access store={store} setStore={setStore} /></Route>
      <Route path="/painel"><Dashboard store={store} setStore={setStore} notify={notify} /></Route>
      <Route path="/colaborador/:id"><CollaboratorWorkspace store={store} setStore={setStore} notify={notify} /></Route>
      <Route path="/historico"><History store={store} /></Route>
      <Route path="/treinamento"><Training store={store} setStore={setStore} notify={notify} /></Route>
      <Route path="/configuracoes"><Settings store={store} setStore={setStore} notify={notify} /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const [store, setStoreState] = useState<Store>(() => readStore());
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const prevApptCountRef = useRef<number>(store.collaborators.reduce((s, p) => s + p.appointments.length, 0));

  const setStore = useCallback((next: Store) => {
    setStoreState(next);
    localStorage.setItem('odonto-excellence-v2', JSON.stringify(next));
  }, []);

  const notify = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev.slice(-2), { id, message, kind }]);
    if (store.soundEnabled) {
      playNotificationSound(kind === 'notify' ? 'alert' : 'success');
    }
  }, [store.soundEnabled]);

  // Real-time: detect new appointments added by any tab (storage event)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== 'odonto-excellence-v2' || !e.newValue) return;
      try {
        const next = JSON.parse(e.newValue) as Store;
        const newCount = next.collaborators.reduce((s, p) => s + p.appointments.length, 0);
        if (newCount > prevApptCountRef.current) {
          setStoreState(next);
          const diff = newCount - prevApptCountRef.current;
          notify(`${diff} novo${diff > 1 ? 's' : ''} agendamento${diff > 1 ? 's' : ''} adicionado${diff > 1 ? 's' : ''}!`, 'notify');
        } else {
          setStoreState(next);
        }
        prevApptCountRef.current = newCount;
      } catch { /* ignore */ }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [notify]);

  // Track appointment count for sound when changed locally
  useEffect(() => {
    const count = store.collaborators.reduce((s, p) => s + p.appointments.length, 0);
    prevApptCountRef.current = count;
  }, [store.collaborators]);

  // Midnight rollover check
  useEffect(() => {
    const t = setInterval(() => { if (localDateKey() !== today) window.location.reload(); }, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    document.title = 'Odonto Excellence · Gestão Clínica';
  }, []);

  return (
    <TooltipProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AppRouter store={store} setStore={setStore} notify={notify} />
      </WouterRouter>
      <Toaster />
      {/* Toast stack */}
      <div className="fixed right-5 bottom-5 z-[60] flex flex-col gap-2 items-end">
        {toasts.map((t) => (
          <Toast key={t.id} msg={t} onClose={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </TooltipProvider>
  );
}
