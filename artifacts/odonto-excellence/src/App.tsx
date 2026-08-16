import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link,
  Route,
  Router as WouterRouter,
  Switch,
  useLocation,
  useRoute,
} from "wouter";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileClock,
  GraduationCap,
  Home,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Eye,
  LockKeyhole,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Phone,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings2,
  SlidersHorizontal,
  ShieldCheck,
  Shield,
  Smile,
  Sparkles,
  Paperclip,
  Target,
  Trash2,
  TrendingUp,
  UserRound,
  UsersRound,
  Video,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import NotFound from "@/pages/not-found";

/**
 * Reusable confirmation dialog for destructive/irreversible actions
 * (deleting an appointment, suspending an account, rejecting a request).
 * Before this, those actions fired immediately on a single click with no
 * way to back out - a real risk of losing patient data or locking someone
 * out by accident.
 */
function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  destructive = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ─── TYPES ─── */
type Gender = "feminine" | "masculine" | "neutral";
type AppStatus = "confirmed" | "pending" | "rescheduled";
type Appointment = {
  id: string;
  patient: string;
  date: string;
  time: string;
  note: string;
  status: AppStatus;
};
type Collaborator = {
  id: string;
  name: string;
  role: string;
  city: string;
  priority: string;
  gender: Gender;
  goal: number;
  calls: number;
  messages: number;
  whatsapp: number;
  conversions: number;
  refusals: number;
  appointments: Appointment[];
};
type DayArchive = {
  id: string;
  date: string;
  closedAt: string;
  appointments: Appointment[];
  collaboratorName: string;
  collaborators: Collaborator[];
};
type Training = {
  id: string;
  title: string;
  durationMinutes: number;
  watched: boolean;
  attempts: number;
  area: string;
  ownerId: string;
  createdAt: string;
  completedAt?: string;
};
type StudyBaseline = {
  total: number;
  watched: number;
  minutes: number;
  days: number;
};
type PortalPreferences = {
  compactMode: boolean;
  privacyMode: boolean;
  dailyTips: boolean;
  autoRefresh: boolean;
};
type Store = {
  collaborators: Collaborator[];
  archives: DayArchive[];
  training: Training[];
  studyBaselines: Record<string, StudyBaseline>;
  activeId: string;
  activeDate: string;
  soundEnabled: boolean;
  preferences: PortalPreferences;
};
type AgendaAppointment = Appointment & {
  collaborator: string;
  collaboratorId: string;
  gender: Gender;
};
type PortalEnvelope = {
  state: Record<string, unknown> | null;
  revision: number;
};
type PortalAccountType = "creator" | "manager" | "member" | "individual";
type PortalAccountStatus = "pending" | "active" | "suspended";
type PortalUser = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "member";
  accountType: PortalAccountType;
  accountStatus: PortalAccountStatus;
  managerId: string | null;
  workspaceOwnerId: string;
  mustChangePassword: boolean;
  isActive: boolean;
  teamMemberLimit: number;
};
type PortalNotification = {
  id: string;
  title: string;
  body: string;
  kind?: string;
  createdAt: string;
  readAt: string | null;
};
const PortalAuthContext = createContext<PortalUser | null>(null);
const NotificationContext = createContext<{
  notifications: PortalNotification[];
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
}>({
  notifications: [],
  refresh: async () => undefined,
  markRead: async () => undefined,
});
type SyncStatus = {
  lastSyncedAt: Date | null;
  syncing: boolean;
  syncError: boolean;
};
const SyncStatusContext = createContext<SyncStatus>({
  lastSyncedAt: null,
  syncing: false,
  syncError: false,
});

/* ─── HELPERS ─── */
function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const today = localDateKey();
const ARCHIVE_RETENTION_DAYS = 2;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PORTAL_STORAGE_KEY = "odonto-excellence-v4";
const PORTAL_API_URL = (
  import.meta.env.VITE_ODONTO_API_URL ??
  "https://odonto-excellence-api.onrender.com/api"
).replace(/\/$/, "");
function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
    .format(new Date(`${value}T12:00:00`))
    .replace(".", "");
}
function formatWeekday(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(
    new Date(`${value}T12:00:00`),
  );
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}
function formatLastSeen(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const isToday = localDateKey(date) === localDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = localDateKey(date) === localDateKey(yesterday);
  if (isToday) return `hoje às ${time}`;
  if (isYesterday) return `ontem às ${time}`;
  return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${time}`;
}
function genderTone(g: Gender) {
  return g === "feminine"
    ? "hsl(340 60% 80%)"
    : g === "masculine"
      ? "hsl(210 55% 78%)"
      : "hsl(38 70% 78%)";
}
function percentage(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0)
    return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}
function localDayTimestamp(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}
function pruneArchives(archives: DayArchive[], referenceDate = today) {
  const reference = localDayTimestamp(referenceDate);
  return archives
    .filter((archive) => {
      const timestamp = localDayTimestamp(archive.date);
      const age = Math.floor((reference - timestamp) / DAY_IN_MS);
      return (
        Number.isFinite(timestamp) && age >= 0 && age <= ARCHIVE_RETENTION_DAYS
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}
function statusLabel(status: AppStatus) {
  return status === "confirmed"
    ? "Confirmado"
    : status === "rescheduled"
      ? "Reagendar"
      : "Aguardando";
}
function statusClass(status: AppStatus) {
  return status === "confirmed"
    ? "chip-red"
    : status === "rescheduled"
      ? "chip-coral"
      : "";
}

/* ─── WEB AUDIO NOTIFICATION ─── */
let audioCtx: AudioContext | null = null;
function playNotificationSound(kind: "success" | "alert" = "success") {
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
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + start + dur,
      );
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.02);
    }
  } catch {
    /* silent if audio not available */
  }
}

/* ─── SEED DATA ─── */
function emptyCollaborator(id: string, name: string, goal = 15): Collaborator {
  return {
    id,
    name,
    role: "Equipe comercial",
    city: "Cidade não informada",
    priority: "",
    gender: "neutral",
    goal,
    calls: 0,
    messages: 0,
    whatsapp: 0,
    conversions: 0,
    refusals: 0,
    appointments: [],
  };
}

const initialCollaborators: Collaborator[] = [
  emptyCollaborator("daniel", "Daniel"),
  emptyCollaborator("will", "Will"),
  emptyCollaborator("chaline", "Chaline"),
  emptyCollaborator("queizy", "Queizy", 10),
  emptyCollaborator("mayssa", "Mayssa", 20),
  emptyCollaborator("sara", "Sara"),
];
const initialTraining: Training[] = [
  {
    id: "t1",
    title: "Acolhimento que gera confiança",
    durationMinutes: 9,
    watched: true,
    attempts: 1,
    area: "Experiência",
    ownerId: "daniel",
    createdAt: "2026-08-07T09:00:00.000Z",
    completedAt: "2026-08-07T09:10:00.000Z",
  },
  {
    id: "t2",
    title: "Como conduzir uma avaliação",
    durationMinutes: 12,
    watched: true,
    attempts: 2,
    area: "Comercial",
    ownerId: "daniel",
    createdAt: "2026-08-07T09:12:00.000Z",
    completedAt: "2026-08-07T09:25:00.000Z",
  },
  {
    id: "t3",
    title: "Follow-up sem perder o timing",
    durationMinutes: 7,
    watched: false,
    attempts: 4,
    area: "Relacionamento",
    ownerId: "daniel",
    createdAt: "2026-08-07T09:28:00.000Z",
  },
  {
    id: "t4",
    title: "Organizando uma agenda saudável",
    durationMinutes: 10,
    watched: true,
    attempts: 1,
    area: "Gestão",
    ownerId: "daniel",
    createdAt: "2026-08-07T09:36:00.000Z",
    completedAt: "2026-08-07T09:47:00.000Z",
  },
  {
    id: "t5",
    title: "O cuidado depois da consulta",
    durationMinutes: 8,
    watched: false,
    attempts: 3,
    area: "Experiência",
    ownerId: "daniel",
    createdAt: "2026-08-07T09:50:00.000Z",
  },
  {
    id: "t6",
    title: "Conversas que destravam decisões",
    durationMinutes: 14,
    watched: false,
    attempts: 5,
    area: "Comercial",
    ownerId: "daniel",
    createdAt: "2026-08-07T10:00:00.000Z",
  },
];

// Importado da planilha do Daniel. Os novos registros ficam somente no perfil ativo.
const initialStudyBaselines: Record<string, StudyBaseline> = {
  daniel: { total: 212, watched: 125, minutes: 4_200, days: 7 },
};

function durationToMinutes(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value))
    return Math.max(1, Math.round(value));
  if (typeof value !== "string") return 0;
  const [minutes, seconds = "0"] = value.split(":");
  const parsedMinutes = Number(minutes);
  const parsedSeconds = Number(seconds);
  if (!Number.isFinite(parsedMinutes)) return 0;
  return Math.max(
    1,
    Math.round(
      parsedMinutes +
        (Number.isFinite(parsedSeconds) && parsedSeconds >= 30 ? 1 : 0),
    ),
  );
}

function formatMinutes(minutes: number) {
  const normalized = Math.max(0, Math.round(minutes));
  return normalized >= 60
    ? `${Math.floor(normalized / 60)}h${String(normalized % 60).padStart(2, "0")}`
    : `${normalized} min`;
}

function normalizeTraining(value: unknown): Training[] {
  if (!Array.isArray(value)) return initialTraining;
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Partial<Training> & { duration?: unknown };
    const title = typeof source.title === "string" ? source.title.trim() : "";
    if (!title) return [];
    const durationMinutes = durationToMinutes(
      source.durationMinutes ?? source.duration,
    );
    return [
      {
        id:
          typeof source.id === "string" && source.id
            ? source.id
            : `legacy-study-${index}`,
        title,
        durationMinutes: durationMinutes || 1,
        watched: Boolean(source.watched),
        attempts: Number.isFinite(source.attempts)
          ? Math.max(0, Math.round(source.attempts as number))
          : 0,
        area:
          typeof source.area === "string" && source.area.trim()
            ? source.area.trim()
            : "Geral",
        // Registros antigos eram do painel-base do Daniel; nunca os replicamos para outros perfis.
        ownerId:
          typeof source.ownerId === "string" && source.ownerId
            ? source.ownerId
            : "daniel",
        createdAt:
          typeof source.createdAt === "string"
            ? source.createdAt
            : "2026-08-07T00:00:00.000Z",
        completedAt:
          typeof source.completedAt === "string"
            ? source.completedAt
            : undefined,
      },
    ];
  });
}

function normalizeStudyBaselines(
  value: unknown,
): Record<string, StudyBaseline> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return initialStudyBaselines;
  const normalized: Record<string, StudyBaseline> = {};
  for (const [ownerId, raw] of Object.entries(
    value as Record<string, Partial<StudyBaseline>>,
  )) {
    normalized[ownerId] = {
      total: Math.max(0, Math.round(Number(raw.total) || 0)),
      watched: Math.max(0, Math.round(Number(raw.watched) || 0)),
      minutes: Math.max(0, Math.round(Number(raw.minutes) || 0)),
      days: Math.max(0, Math.round(Number(raw.days) || 0)),
    };
  }
  return { ...initialStudyBaselines, ...normalized };
}

function studySummary(store: Store, ownerId: string) {
  const baseline = store.studyBaselines[ownerId] ?? {
    total: 0,
    watched: 0,
    minutes: 0,
    days: 0,
  };
  const records = store.training.filter((item) => item.ownerId === ownerId);
  const watchedRecords = records.filter((item) => item.watched);
  const total = baseline.total + records.length;
  const watched = baseline.watched + watchedRecords.length;
  const minutes =
    baseline.minutes +
    watchedRecords.reduce((sum, item) => sum + item.durationMinutes, 0);
  return {
    records,
    watched,
    total,
    minutes,
    days: baseline.days,
    remaining: Math.max(0, total - watched),
    percentage: total ? Math.round((watched / total) * 100) : 0,
  };
}

function normalizeCollaborators(collaborators: Collaborator[]): Collaborator[] {
  const isLegacyEmptyPortal =
    collaborators.length === 1 && collaborators[0]?.id === "coordenacao";
  if (isLegacyEmptyPortal) return initialCollaborators;
  return collaborators.map((collaborator) => ({
    ...collaborator,
    city: collaborator.city?.trim() || "Cidade não informada",
    priority: collaborator.priority ?? "",
    goal: Number.isFinite(collaborator.goal) ? collaborator.goal : 0,
    calls: Number.isFinite(collaborator.calls) ? collaborator.calls : 0,
    messages: Number.isFinite(collaborator.messages)
      ? collaborator.messages
      : 0,
    whatsapp: Number.isFinite(collaborator.whatsapp)
      ? collaborator.whatsapp
      : 0,
    conversions: Number.isFinite(collaborator.conversions)
      ? collaborator.conversions
      : 0,
    refusals: Number.isFinite(collaborator.refusals)
      ? collaborator.refusals
      : 0,
    appointments: Array.isArray(collaborator.appointments)
      ? collaborator.appointments
      : [],
  }));
}

/* ─── STORE ─── */
function normalizeStore(value: Partial<Store>): Store {
  const collaborators = normalizeCollaborators(
    value.collaborators ?? initialCollaborators,
  );
  const storedDate = value.activeDate ?? today;
  const archives = value.archives ?? [];
  const training = normalizeTraining(value.training);
  const studyBaselines = normalizeStudyBaselines(value.studyBaselines);

  if (storedDate !== today) {
    const hasData = collaborators.some(
      (person) =>
        person.appointments.length > 0 ||
        person.calls > 0 ||
        person.messages > 0 ||
        person.whatsapp > 0 ||
        person.conversions > 0 ||
        person.refusals > 0,
    );
    const rollover: DayArchive = {
      id: `archive-auto-${storedDate}`,
      date: storedDate,
      closedAt: "virada automática",
      appointments: collaborators.flatMap((person) =>
        person.appointments.map((appointment) => ({ ...appointment })),
      ),
      collaboratorName: "Equipe Odonto Excellence",
      collaborators: collaborators.map((person) => ({
        ...person,
        appointments: [...person.appointments],
      })),
    };
    return {
      collaborators: collaborators.map((person) => ({
        ...person,
        calls: 0,
        messages: 0,
        whatsapp: 0,
        conversions: 0,
        refusals: 0,
        appointments: [],
      })),
      archives: pruneArchives(hasData ? [rollover, ...archives] : archives),
      training,
      studyBaselines,
      activeId: value.activeId ?? collaborators[0]?.id ?? "daniel",
      activeDate: today,
      soundEnabled: value.soundEnabled ?? true,
      preferences: value.preferences ?? {
        compactMode: false,
        privacyMode: false,
        dailyTips: true,
        autoRefresh: true,
      },
    };
  }

  return {
    collaborators,
    archives: pruneArchives(archives),
    training,
    studyBaselines,
    activeId: value.activeId ?? collaborators[0]?.id ?? "daniel",
    activeDate: today,
    soundEnabled: value.soundEnabled ?? true,
    preferences: value.preferences ?? {
      compactMode: false,
      privacyMode: false,
      dailyTips: true,
      autoRefresh: true,
    },
  };
}

function readStore(): Store {
  try {
    const saved = localStorage.getItem(PORTAL_STORAGE_KEY);
    if (saved) return normalizeStore(JSON.parse(saved) as Partial<Store>);
  } catch {
    /* use seed */
  }
  return {
    collaborators: [],
    archives: [],
    training: [],
    studyBaselines: {},
    activeId: "",
    activeDate: today,
    soundEnabled: true,
    preferences: {
      compactMode: false,
      privacyMode: false,
      dailyTips: true,
      autoRefresh: true,
    },
  };
}

function personalStore(user: PortalUser): Store {
  const collaborator = emptyCollaborator(user.id, user.displayName);
  const isAdmin = user.role === "admin";
  const training = isAdmin
    ? initialTraining.map((item) => ({ ...item, ownerId: user.id }))
    : [];
  const studyBaselines = isAdmin
    ? { [user.id]: initialStudyBaselines.daniel }
    : {};
  return {
    collaborators: [collaborator],
    archives: [],
    training,
    studyBaselines,
    activeId: user.id,
    activeDate: today,
    soundEnabled: true,
    preferences: {
      compactMode: false,
      privacyMode: false,
      dailyTips: true,
      autoRefresh: true,
    },
  };
}

function storeFromRemote(value: Record<string, unknown>): Store | null {
  if (
    !Array.isArray(value.collaborators) ||
    !Array.isArray(value.archives) ||
    !Array.isArray(value.training)
  )
    return null;
  return normalizeStore(value as Partial<Store>);
}

/* ─── BRAND LOGO ─── */
function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand-lockup ${dark ? "brand-lockup-dark" : ""}`}
    >
      <span className="brand-logo-frame">
        <img
          src="/brand/odonto-excellence-logo.png"
          alt="Odonto Excellence"
          className="brand-logo"
        />
      </span>
      <span className="brand-clinic-label">
        <span>ODONTO EXCELLENCE</span>
        <small>PORTAL DO COLABORADOR</small>
      </span>
    </Link>
  );
}

/* ─── BACK TO MENU BUTTON ─── */
function BackToMenu({ label = "Menu principal" }: { label?: string }) {
  const [, setLocation] = useLocation();
  return (
    <button onClick={() => setLocation("/painel")} className="btn-menu">
      <Home size={14} /> {label}
    </button>
  );
}

/* ─── SIDEBAR ─── */
function Sidebar({
  activeId,
  soundEnabled,
  onToggleSound,
  onClose,
}: {
  activeId: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onClose: () => void;
}) {
  const portalUser = useContext(PortalAuthContext);
  const [location] = useLocation();
  const navItems = [
    { href: "/painel", label: "Início", icon: LayoutDashboard },
    { href: `/colaborador/${activeId}`, label: "Meu dia", icon: UserRound },
    { href: "/historico", label: "Histórico", icon: FileClock },
    { href: "/treinamento", label: "Ambiente Videos", icon: GraduationCap },
    { href: "/chat", label: "Chat", icon: MessageCircle },
    { href: "/configuracoes", label: "Configurações", icon: Settings2 },
  ];
  if (
    portalUser?.accountType === "creator" ||
    portalUser?.accountType === "manager"
  )
    navItems.push({ href: "/admin", label: "Usuários", icon: Shield });
  return (
    <aside className="sidebar">
      <div className="brand flex items-center justify-between">
        <Brand dark />
        <button
          onClick={onClose}
          className="button-ghost button-icon text-white/60 md:hidden"
          aria-label="Fechar menu"
        >
          <X size={17} />
        </button>
      </div>
      <div className="nav-section">
        <div className="nav-label">Hoje</div>
        <nav className="space-y-1">
          {navItems.slice(0, 3).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`nav-item ${location === href || (href.includes("/colaborador") && location.startsWith("/colaborador")) ? "active" : ""}`}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
      <div className="nav-section">
        <div className="nav-label">Apoio</div>
        <nav className="space-y-1">
          {navItems.slice(3).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`nav-item ${location === href ? "active" : ""}`}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
      <div className="mt-auto space-y-3">
        <button
          onClick={onToggleSound}
          className={`nav-item w-full text-left gap-3 ${soundEnabled ? "text-[hsl(var(--sidebar-primary))]" : "opacity-50"}`}
          title={soundEnabled ? "Desativar som" : "Ativar som"}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          <span className="text-xs">
            {soundEnabled ? "Som ativo" : "Som desativado"}
          </span>
        </button>
        <div className="panel p-3 !bg-white/5 !border-white/10">
          <div className="flex gap-2 text-xs text-white/80">
            <ShieldCheck
              size={16}
              className="text-[hsl(var(--sidebar-primary))] shrink-0"
            />
            <span>Rotina centralizada da equipe.</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MobileNav({ activeId }: { activeId: string }) {
  const [location] = useLocation();
  return (
    <div className="mobile-menu">
      {(
        [
          ["/painel", "Início", LayoutDashboard],
          [`/colaborador/${activeId}`, "Meu dia", UserRound],
          ["/historico", "Histórico", FileClock],
          ["/treinamento", "Ambiente Videos", GraduationCap],
        ] as [string, string, typeof Home][]
      ).map(([href, label, Icon]) => (
        <Link
          key={href}
          href={href}
          className={`nav-item ${location === href || (href.includes("/colaborador") && location.startsWith("/colaborador")) ? "active" : ""}`}
        >
          <Icon size={14} />
          <span>{label}</span>
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
      ref.current.classList.remove("ring-bell");
      void ref.current.offsetWidth;
      ref.current.classList.add("ring-bell");
    }
  }, [count]);
  return (
    <span className="relative inline-flex">
      <span ref={ref}>
        <Bell size={18} />
      </span>
      {count > 0 && (
        <span className="notif-badge">{count > 9 ? "9+" : count}</span>
      )}
    </span>
  );
}

/* ─── APP SHELL ─── */
function AppShell({
  children,
  store,
  onToggleSound,
}: {
  children: React.ReactNode;
  store: Store;
  onToggleSound: () => void;
}) {
  const portalUser = useContext(PortalAuthContext);
  const notificationCenter = useContext(NotificationContext);
  const syncStatus = useContext(SyncStatusContext);
  const [, setLocation] = useLocation();
  const active =
    store.collaborators.find((p) => p.id === store.activeId) ??
    store.collaborators[0];
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const pendingCount = store.collaborators
    .flatMap((p) => p.appointments)
    .filter((a) => a.status === "pending").length;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const todayNotifications = notificationCenter.notifications.filter(
    (item) => new Date(item.createdAt).getTime() >= dayStart.getTime(),
  );
  const unreadCount = todayNotifications.filter((item) => !item.readAt).length;
  const systemNotifications =
    pendingCount > 0
      ? [
          {
            id: "pending-system",
            title: "Agenda precisa de atenção",
            body: `${pendingCount} agendamento${pendingCount === 1 ? "" : "s"} aguardando confirmação.`,
            kind: "system",
            createdAt: new Date().toISOString(),
            readAt: null,
          },
        ]
      : [];
  const visibleNotifications = [...systemNotifications, ...todayNotifications];

  return (
    <div className={`app-shell shell-bg ${store.preferences.compactMode ? "portal-compact" : ""} ${store.preferences.privacyMode ? "portal-private" : ""}`}>
      <div className="hidden md:block">
        <Sidebar
          activeId={active?.id ?? "daniel"}
          soundEnabled={store.soundEnabled}
          onToggleSound={onToggleSound}
          onClose={() => undefined}
        />
      </div>
      <div className="main-area">
        <header className="topbar">
          <button
            className="button-ghost button-icon md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-mono font-bold">REDE NACIONAL</span>
            <span className="opacity-30 mx-1">/</span>
            <span>Odonto Excellence</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <span
              className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground"
              title={
                syncStatus.syncError
                  ? "Não foi possível sincronizar com o servidor. Suas alterações continuam salvas neste navegador."
                  : syncStatus.lastSyncedAt
                    ? `Última sincronização: ${syncStatus.lastSyncedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                    : "Aguardando primeira sincronização"
              }
            >
              {syncStatus.syncError ? (
                <>
                  <AlertTriangle size={13} className="text-amber-500" />
                  <span className="text-amber-600 font-medium">
                    Sem conexão
                  </span>
                </>
              ) : syncStatus.syncing ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  Sincronizando...
                </>
              ) : syncStatus.lastSyncedAt ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Sincronizado às{" "}
                  {syncStatus.lastSyncedAt.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </>
              ) : null}
            </span>
            <div className="relative">
              <button
                className={`button-ghost button-icon relative ${notificationsOpen ? "notification-trigger-active" : ""}`}
                aria-label="Notificações"
                onClick={() => {
                  setNotificationsOpen((open) => !open);
                  void notificationCenter.refresh();
                }}
              >
                <NotifBell count={unreadCount + systemNotifications.length} />
              </button>
              {notificationsOpen && (
                <div className="notification-popover">
                  <div className="notification-popover-head">
                    <div>
                      <span className="eyebrow">Central do dia</span>
                      <h2>Notificações</h2>
                    </div>
                    <button
                      className="button-ghost button-icon"
                      onClick={() => setNotificationsOpen(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="notification-list">
                    {visibleNotifications.length === 0 && (
                      <div className="notification-empty">
                        <Bell size={20} />
                        <b>Tudo tranquilo por aqui</b>
                        <span>
                          Novidades do sistema e comunicados aparecerão neste
                          espaço.
                        </span>
                      </div>
                    )}
                    {visibleNotifications.map((item) => (
                      <button
                        key={item.id}
                        className={`notification-item ${!item.readAt ? "unread" : ""}`}
                        onClick={() => {
                          if (!item.id.endsWith("-system"))
                            void notificationCenter.markRead(item.id);
                          if (item.kind === "access_request") {
                            setNotificationsOpen(false);
                            setLocation("/admin");
                          }
                        }}
                      >
                        <span className="notification-item-icon">
                          {item.id.endsWith("-system") ? (
                            <CalendarDays size={15} />
                          ) : (
                            <Megaphone size={15} />
                          )}
                        </span>
                        <span>
                          <b>{item.title}</b>
                          <small>{item.body}</small>
                          <em>
                            {new Intl.DateTimeFormat("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(item.createdAt))}
                          </em>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Link
              href={`/colaborador/${active?.id}`}
              className="flex items-center gap-2"
            >
              <span
                className="avatar w-8 h-8"
                style={{ background: genderTone(active?.gender ?? "neutral") }}
              >
                {initials(active?.name ?? "OE")}
              </span>
              <span className="hidden sm:block text-xs font-bold">
                {portalUser?.displayName ?? active?.name}
              </span>
            </Link>
          </div>
        </header>
        <div className="md:hidden px-4 pt-1">
          <MobileNav activeId={active?.id ?? "daniel"} />
        </div>
        {children}
      </div>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden bg-[rgba(30,4,4,.42)]"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="w-[82%] max-w-[300px] h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar
              activeId={active?.id ?? "daniel"}
              soundEnabled={store.soundEnabled}
              onToggleSound={onToggleSound}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── TOAST ─── */
type ToastKind = "success" | "notify";
interface ToastMsg {
  id: number;
  message: string;
  kind: ToastKind;
}
function Toast({ msg, onClose }: { msg: ToastMsg; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3800);
    return () => clearTimeout(t);
  }, [msg.id, onClose]);
  const Icon = msg.kind === "notify" ? Bell : CheckCircle2;
  return (
    <div className={`toast-note toast-${msg.kind} flex items-center gap-3`}>
      <Icon
        size={16}
        className={
          msg.kind === "notify"
            ? "text-[hsl(38,90%,54%)]"
            : "text-[hsl(var(--sidebar-primary))]"
        }
      />
      <span>{msg.message}</span>
    </div>
  );
}

/* ─── STAT CARD ─── */
function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof CalendarDays;
  accent?: boolean;
}) {
  return (
    <div className="panel p-4 md:p-5">
      <div className="flex justify-between gap-2">
        <span className="text-[11px] text-muted-foreground font-bold leading-tight uppercase tracking-wide">
          {label}
        </span>
        <Icon size={16} className={accent ? "text-accent" : "text-primary"} />
      </div>
      <div className="stat-value mt-5">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-2">{detail}</div>
    </div>
  );
}

/* ─── EMPTY STATE ─── */
function EmptyState({
  icon: Icon,
  title,
  copy,
  action,
  onAction,
}: {
  icon: typeof CalendarDays;
  title: string;
  copy: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="p-10 text-center">
      <span className="w-12 h-12 rounded-2xl bg-muted text-primary grid place-items-center mx-auto">
        <Icon size={21} />
      </span>
      <h3 className="font-bold mt-4">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-2 leading-relaxed">
        {copy}
      </p>
      {action && onAction && (
        <button onClick={onAction} className="button-primary mt-5">
          {action} <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}

/* ─── CLOSE DAY MODAL ─── */
function CloseDayModal({
  count,
  onCancel,
  onConfirm,
}: {
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card p-7">
        <div className="flex justify-between">
          <span className="w-11 h-11 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <CheckCircle2 size={21} />
          </span>
          <button
            onClick={onCancel}
            className="button-ghost button-icon"
            aria-label="Cancelar"
          >
            <X size={17} />
          </button>
        </div>
        <h2 className="display-title text-3xl mt-6">Salvar e fechar o dia?</h2>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          Vamos guardar{" "}
          <strong>
            {count} {count === 1 ? "encontro" : "encontros"}
          </strong>{" "}
          no histórico e preparar a clínica para amanhã. Nada é apagado.
        </p>
        <div className="flex justify-end gap-2 mt-8">
          <button className="button-secondary" onClick={onCancel}>
            Voltar
          </button>
          <button className="button-primary" onClick={onConfirm}>
            <Check size={15} /> Salvar e fechar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── GOAL MODAL ─── */
function GoalModal({
  person,
  onCancel,
  onSave,
}: {
  person: Collaborator;
  onCancel: () => void;
  onSave: (goal: number) => void;
}) {
  const [goal, setGoal] = useState(String(person.goal));
  return (
    <div className="modal-backdrop">
      <form
        className="modal-card p-7"
        onSubmit={(event) => {
          event.preventDefault();
          const nextGoal = Math.max(1, Math.round(Number(goal) || 0));
          onSave(nextGoal);
        }}
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="eyebrow">Meta de conversões</div>
            <h2 className="display-title text-3xl mt-2">Ajustar meta.</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="button-ghost button-icon"
            aria-label="Fechar"
          >
            <X size={17} />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
          Defina quantas conversões <strong>{person.name}</strong> deve buscar
          no dia. A equipe acompanha a atualização na rotina compartilhada.
        </p>
        <label className="block mt-7">
          <span className="label-text">Conversões esperadas por dia</span>
          <div className="goal-input-wrap">
            <Target size={17} className="text-primary" />
            <input
              type="number"
              min="1"
                  max="250"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              className="goal-input"
              autoFocus
              aria-label="Meta de conversões"
            />
            <span className="text-xs text-muted-foreground">conversões</span>
          </div>
        </label>
        <div className="flex justify-end gap-2 mt-7">
          <button type="button" className="button-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="button-primary">
            <Save size={15} /> Salvar meta
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── APPOINTMENT MODAL ─── */
function AppointmentModal({
  appointment,
  onCancel,
  onSave,
}: {
  appointment: Appointment | null;
  onCancel: () => void;
  onSave: (a: Appointment) => void;
}) {
  const [form, setForm] = useState<Appointment>(
    appointment ?? {
      id: `a-${Date.now()}`,
      patient: "",
      date: today,
      time: "09:00",
      note: "",
      status: "pending",
    },
  );
  const upd = (k: keyof Appointment, v: string) =>
    setForm({ ...form, [k]: v } as Appointment);
  return (
    <div className="modal-backdrop">
      <form
        className="modal-card p-7"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.patient.trim()) onSave(form);
        }}
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="eyebrow">
              {appointment ? "Editar" : "Novo encontro"}
            </div>
            <h2 className="display-title text-3xl mt-2">
              {appointment ? "Ajustar encontro" : "Adicionar encontro"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="button-ghost button-icon"
            aria-label="Fechar"
          >
            <X size={17} />
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mt-7">
          <label className="sm:col-span-2">
            <span className="label-text">Nome do paciente *</span>
            <input
              required
              value={form.patient}
              onChange={(e) => upd("patient", e.target.value)}
              className="input-field"
              placeholder="Ex.: Ana Beatriz"
              autoFocus
            />
          </label>
          <label>
            <span className="label-text">Data</span>
            <input
              type="date"
              value={form.date}
              onChange={(e) => upd("date", e.target.value)}
              className="input-field"
            />
          </label>
          <label>
            <span className="label-text">Horário</span>
            <input
              type="time"
              value={form.time}
              onChange={(e) => upd("time", e.target.value)}
              className="input-field"
            />
          </label>
          <label>
            <span className="label-text">Status</span>
            <select
              value={form.status}
              onChange={(e) => upd("status", e.target.value)}
              className="select-field"
            >
              <option value="pending">Aguardando confirmação</option>
              <option value="confirmed">Confirmado</option>
              <option value="rescheduled">Precisa reagendar</option>
            </select>
          </label>
          <label className="sm:col-span-1">
            <span className="label-text">Nota rápida</span>
            <textarea
              value={form.note}
              onChange={(e) => upd("note", e.target.value)}
              rows={2}
              className="textarea-field resize-none"
              placeholder="O que a equipe precisa saber?"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" className="button-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="button-primary">
            <Save size={15} /> Salvar encontro
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── TEAM PULSE ─── */
function TeamPulse({
  store,
  onOpen,
  onEditGoal,
}: {
  store: Store;
  onOpen: (id: string) => void;
  onEditGoal: (person: Collaborator) => void;
}) {
  return (
    <section className="panel p-5">
      <div className="eyebrow">Pulso do time</div>
      <h2 className="font-bold text-lg mt-2">Cada pessoa, seu movimento.</h2>
      <div className="space-y-4 mt-5">
        {store.collaborators.map((p) => {
          const pct = percentage(p.conversions, p.goal);
          const fillClass =
            pct >= 80 ? "" : pct >= 50 ? "progress-fill-gold" : "progress-fill";
          return (
            <div key={p.id} className="w-full text-left group">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpen(p.id)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <span
                    className="avatar w-8 h-8"
                    style={{ background: genderTone(p.gender) }}
                  >
                    {initials(p.name)}
                  </span>
                  <span className="text-xs font-bold flex-1">{p.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {p.conversions}/{p.goal}
                  </span>
                  <ChevronRight
                    size={14}
                    className="text-muted-foreground group-hover:text-primary transition-colors"
                  />
                </button>
                <button
                  type="button"
                  className="button-ghost button-icon !w-7 !h-7"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditGoal(p);
                  }}
                  aria-label={`Editar meta de ${p.name}`}
                  title={`Editar meta de ${p.name}`}
                >
                  <Pencil size={12} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => onOpen(p.id)}
                className="w-full text-left"
              >
                <div className="progress-track mt-2 ml-11">
                  <div
                    className={`progress-fill ${fillClass}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {p.priority && (
                  <p className="ml-11 mt-2 text-[10px] text-muted-foreground truncate">
                    Foco: {p.priority}
                  </p>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── TRAINING SNAPSHOT ─── */
function TrainingSnapshot({
  summary,
  onOpen,
}: {
  summary: ReturnType<typeof studySummary>;
  onOpen: () => void;
}) {
  return (
    <section className="panel p-5">
      <div className="flex justify-between items-start">
        <div>
          <div className="eyebrow">Treinamento</div>
          <h2 className="font-bold text-lg mt-2">
            Vídeos também fazem parte da rotina.
          </h2>
        </div>
        <button
          className="button-ghost button-icon"
          onClick={onOpen}
          aria-label="Abrir treinamento"
        >
          <ArrowRight size={16} />
        </button>
      </div>
      <div className="flex items-center gap-7 mt-7">
        <div
          className="metric-ring"
          style={{ "--pct": `${summary.percentage}%` } as React.CSSProperties}
        >
          <div className="metric-ring-content">
            <b className="text-2xl">{summary.percentage}%</b>
            <span className="text-[9px] block text-muted-foreground">
              concluído
            </span>
          </div>
        </div>
        <div>
          <div className="text-sm font-bold">
            {summary.watched} de {summary.total} aulas
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            10 minutos de preparo
            <br />
            mudam a próxima conversa.
          </p>
          <button
            className="text-xs text-primary font-bold mt-3 hover:underline"
            onClick={onOpen}
          >
            Continuar trilha <ArrowRight size={12} className="inline" />
          </button>
        </div>
      </div>
    </section>
  );
}

/* ─── PRIORITY ITEM ─── */
function Priority({
  icon: Icon,
  title,
  detail,
  tone,
}: {
  icon: typeof Zap;
  title: string;
  detail: string;
  tone: "coral" | "red" | "gold";
}) {
  const cls =
    tone === "coral"
      ? "bg-accent/15 text-accent"
      : tone === "red"
        ? "bg-primary/10 text-primary"
        : "bg-[hsl(38,90%,54%)]/20 text-[hsl(38,70%,42%)]";
  return (
    <div className="flex gap-3 items-center">
      <span
        className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${cls}`}
      >
        <Icon size={16} />
      </span>
      <div>
        <div className="text-xs font-bold">{title}</div>
        <div className="text-[10px] text-muted-foreground mt-1">{detail}</div>
      </div>
    </div>
  );
}

/* ─── ACTIVITY PANEL ─── */
function ActivityPanel({
  person,
  updatePerson,
  notify,
}: {
  person: Collaborator;
  updatePerson: (p: Collaborator) => void;
  notify: (m: string, k?: ToastKind) => void;
}) {
  const fields: {
    key: "calls" | "messages" | "whatsapp" | "conversions" | "refusals";
    label: string;
    icon: typeof Phone;
  }[] = [
    { key: "calls", label: "Ligações", icon: Phone },
    { key: "messages", label: "Mensagens", icon: MessageCircle },
    { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    { key: "conversions", label: "Conversões", icon: TrendingUp },
    { key: "refusals", label: "Recusas", icon: Ban },
  ];
  function adjust(
    key: "calls" | "messages" | "whatsapp" | "conversions" | "refusals",
    amount: number,
  ) {
    updatePerson({ ...person, [key]: Math.max(0, person[key] + amount) });
  }
  return (
    <section className="panel p-5">
      <div className="eyebrow">Registrar atividade</div>
      <h2 className="font-bold text-lg mt-2">O que você já fez hoje</h2>
      <p className="text-xs text-muted-foreground mt-2">
        Use + depois de cada contato. Você pode corrigir o número quando quiser.
      </p>
      <div className="space-y-3 mt-6">
        {fields.map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <Icon size={14} />
            </span>
            <span className="text-xs font-bold flex-1">{label}</span>
            <div className="counter-control">
              <button
                type="button"
                onClick={() => adjust(key, -1)}
                aria-label={`Diminuir ${label}`}
                data-testid={`button-decrease-${key}`}
              >
                −
              </button>
              <input
                type="number"
                min="0"
                value={person[key]}
                onChange={(e) =>
                  updatePerson({
                    ...person,
                    [key]: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                onBlur={() => notify("Atividade salva.")}
                aria-label={label}
                data-testid={`input-activity-${key}`}
              />
              <button
                type="button"
                onClick={() => adjust(key, 1)}
                aria-label={`Aumentar ${label}`}
                data-testid={`button-increase-${key}`}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>
      <label className="block mt-5">
        <span className="label-text">Prioridade do dia</span>
        <textarea
          value={person.priority}
          onChange={(event) =>
            updatePerson({ ...person, priority: event.target.value })
          }
          onBlur={() => notify("Prioridade atualizada.")}
          rows={2}
          className="textarea-field resize-none mt-2"
          placeholder="Ex.: confirmar retornos da tarde"
        />
      </label>
      <div className="border-t border-border mt-6 pt-5">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-muted-foreground">Meta do período</span>
          <b className="text-primary">
            {percentage(person.conversions, person.goal)}%
          </b>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${percentage(person.conversions, person.goal)}%` }}
          />
        </div>
      </div>
    </section>
  );
}

/* ─── NEXT STEP ─── */
function NextStepCard({
  appointment,
  pendingCount,
  onPrimary,
  onSecondary,
}: {
  appointment?: AgendaAppointment;
  pendingCount: number;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  const hasAppointment = Boolean(appointment);
  const isPending = appointment?.status === "pending";
  const isRescheduled = appointment?.status === "rescheduled";
  return (
    <section className="next-step-card panel mt-6" data-testid="card-next-step">
      <div className="next-step-icon">
        <Zap size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="eyebrow">Próximo passo</div>
        <h2 className="font-bold text-lg mt-1">
          {isPending
            ? "Confirme um agendamento"
            : isRescheduled
              ? "Ajuste um reagendamento"
              : hasAppointment
                ? "Prepare o próximo atendimento"
                : "Comece sua agenda"}
        </h2>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
          {isPending
            ? `${pendingCount} ${pendingCount === 1 ? "pessoa espera" : "pessoas esperam"} uma confirmação da equipe.`
            : appointment
              ? `${appointment.time} · ${appointment.patient} · ${appointment.collaborator}`
              : "Adicione o primeiro paciente para organizar o dia."}
        </p>
      </div>
      <div className="next-step-actions">
        <button
          className="button-primary"
          onClick={onPrimary}
          data-testid="button-next-step-primary"
        >
          {isPending ? "Confirmar agora" : "Abrir meu dia"}
          <ArrowRight size={14} />
        </button>
        {hasAppointment && (
          <button
            className="button-secondary"
            onClick={onSecondary}
            data-testid="button-next-step-secondary"
          >
            Ver agenda
          </button>
        )}
      </div>
    </section>
  );
}

/* ─── PROFILE MODAL ─── */
function ProfileModal({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (p: Collaborator) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [city, setCity] = useState("");
  const [gender, setGender] = useState<Gender>("neutral");
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      ...emptyCollaborator(
        `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
        name.trim(),
      ),
      role: role.trim() || "Equipe clínica",
      city: city.trim() || "Cidade não informada",
      gender,
    });
  };
  return (
    <div className="modal-backdrop">
      <form className="modal-card p-7" onSubmit={save}>
        <div className="flex justify-between items-start">
          <div>
            <div className="eyebrow">Equipe</div>
            <h2 className="display-title text-3xl mt-2">Novo perfil.</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="button-ghost button-icon"
          >
            <X size={17} />
          </button>
        </div>
        <label className="block mt-7">
          <span className="label-text">Nome *</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field"
            placeholder="Ex.: Helena"
            autoFocus
          />
        </label>
        <label className="block mt-4">
          <span className="label-text">Função na clínica</span>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="input-field"
            placeholder="Ex.: Recepção"
          />
        </label>
        <label className="block mt-4">
          <span className="label-text">Cidade e UF</span>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="input-field"
            placeholder="Ex.: Curitiba, PR"
          />
        </label>
        <fieldset className="mt-5">
          <legend className="label-text">Apresentação do avatar</legend>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {(
              [
                ["feminine", "Feminina"],
                ["masculine", "Masculino"],
                ["neutral", "Neutro/Prefiro não dizer"],
              ] as [Gender, string][]
            ).map(([v, lbl]) => (
              <label
                key={v}
                className={`rounded-xl border p-3 text-center text-[11px] font-bold cursor-pointer transition-colors ${gender === v ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
              >
                <input
                  type="radio"
                  name="gender"
                  value={v}
                  checked={gender === v}
                  onChange={() => setGender(v)}
                  className="sr-only"
                />
                <span
                  className="avatar w-8 h-8 mx-auto mb-2 block"
                  style={{ background: genderTone(v) }}
                >
                  {initials(name || "OE")}
                </span>
                <span className="block leading-tight">{lbl}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2 mt-7">
          <button type="button" className="button-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="button-primary">
            <Save size={15} /> Criar perfil
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── FEATURE CARD ─── */
function Feature({
  icon: Icon,
  title,
  copy,
}: {
  icon: typeof CalendarDays;
  title: string;
  copy: string;
}) {
  return (
    <div className="landing-card p-5 hover:-translate-y-1 transition-transform duration-200">
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
        <Icon size={18} />
      </div>
      <h3 className="font-bold text-sm mt-4">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed mt-2">
        {copy}
      </p>
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
      <nav className="landing-nav sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border">
        <Brand />
        <div className="flex items-center gap-4">
          <a
            href="#recursos"
            className="hidden sm:block text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            Recursos
          </a>
          <Link href="/acesso" className="button-primary">
            Entrar no sistema <ArrowRight size={14} />
          </Link>
        </div>
      </nav>

      <section className="section-pad pt-14 md:pt-20">
        <div className="hero-grid max-w-[1320px] mx-auto">
          <div>
            <div className="eyebrow flex items-center gap-2">
              <span className="w-8 h-px bg-primary" />
              Portal interno da rede
            </div>
            <h1 className="display-title text-[clamp(50px,7.5vw,104px)] leading-[.85] mt-6 max-w-[820px]">
              Operacao clinica
              <br />
              <em className="text-primary">com clareza</em>
              <br />
              todos os dias.
            </h1>
            <p className="max-w-[500px] mt-8 text-base md:text-lg leading-relaxed text-muted-foreground">
              Um ambiente privado para equipes Odonto Excellence organizarem
              agenda, acompanhamento, metas e aprendizado sem depender de dados
              de uma unidade especifica.
            </p>
            <div className="flex flex-wrap gap-3 mt-9">
              <button
                onClick={() => setLocation("/acesso")}
                className="button-primary px-6 py-3 text-sm"
              >
                Acessar portal <ArrowRight size={16} />
              </button>
            </div>
          </div>
          <div className="hero-orbit">
            <img
              className="hero-clinic-art"
              src="/clinic/odonto-excellence-hero.jpg"
              alt="Unidade Odonto Excellence"
            />
            <div className="hero-brand-badge">
              <img
                src="/brand/odonto-excellence-logo.png"
                alt="Marca Odonto Excellence"
              />
              <span>
                <b>Odonto Excellence</b>
                <small>Excelência em cada detalhe</small>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="recursos" className="section-pad bg-secondary/20 mt-4">
        <div className="max-w-[1180px] mx-auto grid md:grid-cols-[.8fr_1.2fr] gap-10 items-start">
          <div>
            <div className="eyebrow">Ferramentas da equipe</div>
            <h2 className="display-title text-5xl mt-4 leading-[.92]">
              Menos atrito.
              <br />
              <span className="text-primary">Mais foco.</span>
            </h2>
            <p className="mt-5 text-sm text-muted-foreground leading-relaxed max-w-sm">
              O portal foi pensado para apoiar a rotina de cada colaborador,
              independentemente da cidade ou unidade onde trabalha.
            </p>
            <div className="trust-strip mt-7">
              <span className="trust-dot" />
              <span>
                <strong>Ambiente individual</strong>
                <br />
                Cada equipe organiza os proprios dados.
              </span>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Feature
              icon={CalendarDays}
              title="Agenda que respira"
              copy="Acompanhe consultas, retornos e reagendamentos sem perder o fio da conversa."
            />
            <Feature
              icon={TrendingUp}
              title="Metas com contexto"
              copy="Veja o que avançou hoje e qual é o próximo movimento, sem pressão vazia."
            />
            <Feature
              icon={Bell}
              title="Notificações em tempo real"
              copy="Som e alerta imediatos quando um novo agendamento é criado — para toda a equipe."
            />
            <Feature
              icon={GraduationCap}
              title="Aprendizado vivo"
              copy="Treinamentos acompanhados no mesmo lugar em que a operação acontece."
            />
          </div>
        </div>
      </section>

      <section className="section-pad pt-0">
        <div className="max-w-[1180px] mx-auto landing-card p-7 md:p-12 grid md:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <div className="eyebrow">Uso profissional</div>
            <h2 className="display-title text-4xl md:text-5xl mt-3">
              Comece com um ambiente limpo.
            </h2>
            <p className="text-sm text-muted-foreground mt-3">
              Configure os perfis, metas e agenda da sua equipe no primeiro
              acesso. Nenhum endereco, foto ou dado de unidade vem
              pre-carregado.
            </p>
          </div>
          <button
            onClick={() => setLocation("/acesso")}
            className="button-primary px-6"
          >
            Preparar equipe <ArrowRight size={14} />
          </button>
        </div>
      </section>

      <footer className="px-[7vw] py-8 border-t border-border flex flex-col sm:flex-row justify-between gap-3 text-[11px] text-muted-foreground">
        <span>
          © {new Date().getFullYear()} Odonto Excellence · Portal do Colaborador
        </span>
        <span>Rotina compartilhada da equipe.</span>
      </footer>
    </main>
  );
}

/* ─── ACCESS PAGE ─── */
function Access({
  onAuthenticated,
}: {
  onAuthenticated: (user: PortalUser) => void;
}) {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"login" | "request">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [requestForm, setRequestForm] = useState({
    displayName: "",
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch(
        `${PORTAL_API_URL}/odonto-portal/auth/login`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        user?: PortalUser;
      };
      if (!response.ok || !body.user)
        throw new Error(body.error ?? "Não foi possível continuar.");
      onAuthenticated(body.user);
      setLocation("/painel");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível continuar.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function requestAccess(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const response = await fetch(
        `${PORTAL_API_URL}/odonto-portal/auth/register`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestForm),
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!response.ok)
        throw new Error(body.error ?? "Não foi possível enviar o pedido.");
      setSuccess(
        body.message ??
          "Pedido enviado. Aguarde a aprovação do administrador.",
      );
      setRequestForm({
        displayName: "",
        username: "",
        password: "",
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível enviar o pedido.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="access-page">
      <section className="access-intro">
        <Brand dark />
        <div className="max-w-md mt-auto mb-auto">
          <div className="eyebrow !text-[hsl(var(--sidebar-primary))]">
            Odonto Excellence
          </div>
          <h1 className="display-title text-5xl mt-4 leading-[.9]">
            Seu ambiente pessoal e privado de trabalho.
          </h1>
          <p className="text-sm text-white/65 mt-6 leading-relaxed">
            Organize sua rotina, acompanhe atendimentos e evolua nos
            treinamentos. Seus dados ficam visíveis apenas para você.
          </p>
          <img
            className="mt-10 h-28 w-28 rounded-2xl"
            src="/brand/odonto-excellence-logo.png"
            alt="Marca Odonto Excellence"
          />
        </div>
        <div className="text-xs text-white/40">Odonto Excellence · Brasil</div>
      </section>
      <section className="access-form-wrap">
        <div className="access-form">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} /> Voltar para o início
          </Link>
          <div className="mt-12">
            <div className="eyebrow">Acesso seguro</div>
            <h2 className="display-title text-4xl mt-3">Entre na sua conta.</h2>
            <p className="text-sm text-muted-foreground mt-3">
              Entre com seu acesso ou envie um pedido para o administrador
              aprovar seu ambiente.
            </p>
          </div>
          <div className="access-switch mt-7">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setError("");
                setSuccess("");
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              className={mode === "request" ? "active" : ""}
              onClick={() => {
                setMode("request");
                setError("");
                setSuccess("");
              }}
            >
              Solicitar acesso
            </button>
          </div>
          {mode === "login" ? (
            <form className="space-y-4 mt-7" onSubmit={submit}>
              <label>
                <span className="label-text">Nome de usuário</span>
                <input
                  className="input-field"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  minLength={3}
                  maxLength={32}
                  pattern="[A-Za-z0-9._-]+"
                  required
                />
              </label>
              <label>
                <span className="label-text">Senha</span>
                <input
                  className="input-field"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  minLength={6}
                  required
                />
              </label>
              {error && (
                <p className="text-xs text-destructive font-semibold">
                  {error}
                </p>
              )}
              <button className="button-primary w-full" disabled={busy}>
                {busy ? "Validando acesso..." : "Entrar no portal"}{" "}
                <ArrowRight size={14} />
              </button>
            </form>
          ) : (
            <form className="space-y-4 mt-7" onSubmit={requestAccess}>
              <label>
                <span className="label-text">Nome completo</span>
                <input
                  className="input-field"
                  value={requestForm.displayName}
                  onChange={(e) =>
                    setRequestForm((current) => ({
                      ...current,
                      displayName: e.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                <span className="label-text">Nome de usuário</span>
                <input
                  className="input-field"
                  value={requestForm.username}
                  onChange={(e) =>
                    setRequestForm((current) => ({
                      ...current,
                      username: e.target.value,
                    }))
                  }
                  autoComplete="username"
                  minLength={3}
                  maxLength={32}
                  pattern="[A-Za-z0-9._-]+"
                  required
                />
              </label>
              <label>
                <span className="label-text">Senha</span>
                <input
                  className="input-field"
                  type="password"
                  value={requestForm.password}
                  onChange={(e) =>
                    setRequestForm((current) => ({
                      ...current,
                      password: e.target.value,
                    }))
                  }
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <span className="text-xs text-muted-foreground">
                  Mínimo de 8 caracteres, com letra e número.
                </span>
              </label>
              {error && (
                <p className="text-xs text-destructive font-semibold">
                  {error}
                </p>
              )}
              {success && (
                <p className="text-xs text-primary font-semibold">{success}</p>
              )}
              <button className="button-primary w-full" disabled={busy}>
                {busy ? "Enviando pedido..." : "Enviar para aprovação"}{" "}
                <ArrowRight size={14} />
              </button>
            </form>
          )}
          <p className="text-[11px] text-muted-foreground mt-7 leading-relaxed">
            Ao continuar, você concorda com o uso deste ambiente profissional
            privado.
          </p>
        </div>
      </section>
    </main>
  );
}

/* ─── DASHBOARD ─── */
function Dashboard({
  store,
  setStore,
  notify,
}: {
  store: Store;
  setStore: (s: Store) => void;
  notify: (m: string, k?: ToastKind) => void;
}) {
  const [showClose, setShowClose] = useState(false);
  const [goalPerson, setGoalPerson] = useState<Collaborator | null>(null);
  const [, setLocation] = useLocation();
  const allAppts: AgendaAppointment[] = store.collaborators
    .flatMap((p) =>
      p.appointments.map((a) => ({
        ...a,
        collaborator: p.name,
        collaboratorId: p.id,
        gender: p.gender,
      })),
    )
    .filter((a) => a.date === today)
    .sort((a, b) => a.time.localeCompare(b.time));
  const totalGoal = store.collaborators.reduce((s, p) => s + p.goal, 0);
  const totalConv = store.collaborators.reduce((s, p) => s + p.conversions, 0);
  const totalActivity = store.collaborators.reduce(
    (s, p) => s + p.calls + p.messages + p.whatsapp,
    0,
  );
  const active =
    store.collaborators.find((person) => person.id === store.activeId) ??
    store.collaborators[0];
  const activeStudy = studySummary(store, active?.id ?? "daniel");

  function closeDay() {
    const archivedAppointments = store.collaborators.flatMap((person) =>
      person.appointments.map((appointment) => ({ ...appointment })),
    );
    const archive: DayArchive = {
      id: `archive-${Date.now()}`,
      date: today,
      closedAt: new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      appointments: archivedAppointments,
      collaboratorName: "Equipe Odonto Excellence",
      collaborators: store.collaborators.map((p) => ({
        ...p,
        appointments: [...p.appointments],
      })),
    };
    setStore({
      ...store,
      activeDate: today,
      archives: pruneArchives([archive, ...store.archives]),
      collaborators: store.collaborators.map((p) => ({
        ...p,
        appointments: [],
        calls: 0,
        messages: 0,
        whatsapp: 0,
        conversions: 0,
      })),
    });
    setShowClose(false);
    notify("Dia arquivado. Amanhã começa limpo.");
  }

  const pendingCount = allAppts.filter((a) => a.status === "pending").length;
  const nextAppointment =
    allAppts.find((a) => a.status === "pending") ?? allAppts[0];

  function confirmAppointment(appointment: AgendaAppointment) {
    setStore({
      ...store,
      collaborators: store.collaborators.map((p) =>
        p.id === appointment.collaboratorId
          ? {
              ...p,
              appointments: p.appointments.map((a) =>
                a.id === appointment.id ? { ...a, status: "confirmed" } : a,
              ),
            }
          : p,
      ),
    });
    notify(`${appointment.patient} foi confirmado.`);
  }

  function saveGoal(goal: number) {
    if (!goalPerson) return;
    setStore({
      ...store,
      collaborators: store.collaborators.map((person) =>
        person.id === goalPerson.id ? { ...person, goal } : person,
      ),
    });
    notify(`Meta de ${goalPerson.name} atualizada para ${goal} conversões.`);
    setGoalPerson(null);
  }

  return (
    <AppShell
      store={store}
      onToggleSound={() =>
        setStore({ ...store, soundEnabled: !store.soundEnabled })
      }
    >
      <div className="content-wrap">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <div className="eyebrow">
              {formatDate(today)} · {formatWeekday(today)}
            </div>
            <h1 className="page-title mt-3">
              {greeting()}, {active?.name || "você"}.
            </h1>
            <p className="text-sm text-muted-foreground mt-3">
              Veja o que precisa acontecer e comece pelo próximo passo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="button-secondary"
              onClick={() => setLocation("/colaborador/" + store.activeId)}
            >
              <UserRound size={15} /> Meu dia
            </button>
            <button
              className="button-primary"
              onClick={() => setShowClose(true)}
            >
              <Check size={15} /> Salvar e fechar
            </button>
          </div>
        </div>

        {/* ALERT PENDENTES */}
        {pendingCount > 0 && (
          <div
            className="mt-5 flex items-center gap-3 p-4 rounded-xl bg-[hsl(38,90%,54%)]/12 border border-[hsl(38,90%,54%)]/25"
            role="status"
            data-testid="status-pending-appointments"
          >
            <AlertTriangle
              size={18}
              className="text-[hsl(38,65%,40%)] shrink-0"
            />
            <span className="text-sm font-bold text-[hsl(38,55%,32%)]">
              {pendingCount}{" "}
              {pendingCount === 1
                ? "agendamento precisa"
                : "agendamentos precisam"}{" "}
              de confirmação
            </span>
          </div>
        )}

        <NextStepCard
          appointment={nextAppointment}
          pendingCount={pendingCount}
          onPrimary={() =>
            nextAppointment?.status === "pending"
              ? confirmAppointment(nextAppointment)
              : setLocation(
                  `/colaborador/${nextAppointment?.collaboratorId ?? store.activeId}`,
                )
          }
          onSecondary={() =>
            setLocation(
              `/colaborador/${nextAppointment?.collaboratorId ?? store.activeId}`,
            )
          }
        />

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          <StatCard
            label="Consultas hoje"
            value={allAppts.length.toString()}
            detail={`${allAppts.filter((a) => a.status === "confirmed").length} confirmadas`}
            icon={CalendarDays}
          />
          <StatCard
            label="Meta alcançada"
            value={`${percentage(totalConv, totalGoal)}%`}
            detail={`${totalConv} de ${totalGoal} conversões`}
            icon={TrendingUp}
            accent
          />
          <StatCard
            label="Contatos feitos"
            value={totalActivity.toString()}
            detail="registrados pela equipe"
            icon={MessageCircle}
          />
          <StatCard
            label="Equipe ativa"
            value={store.collaborators.length.toString()}
            detail="pessoas com perfil"
            icon={UsersRound}
          />
        </div>

        {/* AGENDA + PULSE */}
        <div className="grid xl:grid-cols-[1.5fr_.8fr] gap-5 mt-5">
          <section className="panel overflow-hidden">
            <div className="p-5 flex justify-between items-start">
              <div>
                <div className="eyebrow">Agenda da equipe</div>
                <h2 className="font-bold text-lg mt-2">
                  Quem será atendido hoje
                </h2>
              </div>
              <span className="chip chip-red chip-live">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" /> ao vivo
              </span>
            </div>
            {allAppts.length ? (
              <div className="table-wrap">
                <div className="table-row table-head bg-muted/40">
                  <span>Paciente</span>
                  <span>Horário</span>
                  <span>Responsável</span>
                  <span>Observação</span>
                  <span>Status</span>
                </div>
                {allAppts.map((a) => (
                  <div
                    className="table-row hover:bg-muted/30 transition-colors"
                    key={a.id}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="avatar w-8 h-8 text-[9px]"
                        style={{ background: genderTone(a.gender) }}
                      >
                        {initials(a.patient)}
                      </span>
                      <span className="font-bold text-xs">{a.patient}</span>
                    </div>
                    <span className="font-mono text-xs text-primary font-bold">
                      {a.time}
                    </span>
                    <button
                      onClick={() =>
                        setLocation(`/colaborador/${a.collaboratorId}`)
                      }
                      className="text-left text-xs font-bold hover:text-primary transition-colors"
                    >
                      {a.collaborator}
                    </button>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {a.note}
                    </span>
                    <button
                      className={`chip ${statusClass(a.status)} cursor-pointer hover:opacity-80 transition-opacity`}
                      onClick={() =>
                        a.status === "pending"
                          ? confirmAppointment(a)
                          : a.status === "rescheduled"
                            ? setLocation(`/colaborador/${a.collaboratorId}`)
                            : undefined
                      }
                      title={
                        a.status === "confirmed"
                          ? "Agendamento confirmado"
                          : a.status === "pending"
                            ? "Clique para confirmar"
                            : "Abrir para ajustar horário"
                      }
                      data-testid={`button-confirm-${a.id}`}
                    >
                      {statusLabel(a.status)}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="Agenda em branco"
                copy="O fechamento de ontem limpou a fila. Adicione o primeiro encontro do dia."
                action="Abrir minha fila"
                onAction={() => setLocation(`/colaborador/${store.activeId}`)}
              />
            )}
          </section>
          <TeamPulse
            store={store}
            onOpen={(id) => setLocation(`/colaborador/${id}`)}
            onEditGoal={setGoalPerson}
          />
        </div>

        {/* TRAINING + PRIORITIES */}
        <div className="grid lg:grid-cols-2 gap-5 mt-5">
          <TrainingSnapshot
            summary={activeStudy}
            onOpen={() => setLocation("/treinamento")}
          />
          <section className="panel p-5">
            <div className="eyebrow">Uma pausa para olhar</div>
            <h2 className="display-title text-3xl mt-2">
              O que merece
              <br />
              <span className="text-primary">atenção agora?</span>
            </h2>
            <div className="space-y-3 mt-5">
              <Priority
                icon={Zap}
                title={`${pendingCount > 0 ? pendingCount : "Nenhum"} confirmação${pendingCount === 1 ? "" : "ões"} pendente${pendingCount === 1 ? "" : "s"}`}
                detail="Primeiro, resolva o que está parado"
                tone="coral"
              />
              <Priority
                icon={Clock3}
                title="Revise os reagendamentos"
                detail="Depois, ajuste os horários de hoje"
                tone="red"
              />
              <Priority
                icon={GraduationCap}
                title="Continue uma aula curta"
                detail="Quando a agenda estiver em dia"
                tone="gold"
              />
            </div>
          </section>
        </div>
      </div>
      {showClose && (
        <CloseDayModal
          count={allAppts.length}
          onCancel={() => setShowClose(false)}
          onConfirm={closeDay}
        />
      )}
      {goalPerson && (
        <GoalModal
          person={goalPerson}
          onCancel={() => setGoalPerson(null)}
          onSave={saveGoal}
        />
      )}
    </AppShell>
  );
}

/* ─── COLLABORATOR WORKSPACE ─── */
function CollaboratorWorkspace({
  store,
  setStore,
  notify,
}: {
  store: Store;
  setStore: (s: Store) => void;
  notify: (m: string, k?: ToastKind) => void;
}) {
  const [, params] = useRoute("/colaborador/:id");
  const id = params?.id ?? store.activeId;
  const person =
    store.collaborators.find((p) => p.id === id) ?? store.collaborators[0];
  const [showForm, setShowForm] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [confirmDeleteAppt, setConfirmDeleteAppt] =
    useState<Appointment | null>(null);
  const updatePerson = (updated: Collaborator) =>
    setStore({
      ...store,
      collaborators: store.collaborators.map((p) =>
        p.id === updated.id ? updated : p,
      ),
    });

  function removeAppt(apptId: string) {
    updatePerson({
      ...person,
      appointments: person.appointments.filter((a) => a.id !== apptId),
    });
    notify("Encontro removido.");
  }

  return (
    <AppShell
      store={store}
      onToggleSound={() =>
        setStore({ ...store, soundEnabled: !store.soundEnabled })
      }
    >
      <div className="content-wrap">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center gap-5 justify-between">
          <div className="flex items-center gap-4">
            <span
              className="avatar w-16 h-16 text-lg font-bold"
              style={{ background: genderTone(person.gender) }}
            >
              {initials(person.name)}
            </span>
            <div>
              <div className="eyebrow">Workspace individual</div>
              <h1 className="page-title mt-1">{person.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {person.role}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="button-secondary"
              onClick={() => setShowGoal(true)}
            >
              <Target size={15} /> Editar meta
            </button>
            <button
              className="button-primary"
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              <Plus size={15} /> Novo encontro
            </button>
            <BackToMenu />
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
          <StatCard
            label="Meta do período"
            value={`${person.conversions}/${person.goal}`}
            detail={`${percentage(person.conversions, person.goal)}% atingido`}
            icon={TrendingUp}
            accent
          />
          <StatCard
            label="Na agenda"
            value={`${person.appointments.length}`}
            detail="encontros em aberto"
            icon={CalendarDays}
          />
          <StatCard
            label="Contatos"
            value={`${person.calls + person.messages + person.whatsapp}`}
            detail={`${person.calls} lig. · ${person.whatsapp} WhatsApp`}
            icon={Phone}
          />
          <StatCard
            label="Conversão"
            value={`${Math.round((person.conversions / Math.max(1, person.calls + person.messages + person.whatsapp)) * 100)}%`}
            detail="sobre atividades"
            icon={Zap}
          />
        </div>

        {/* APPOINTMENTS + ACTIVITY */}
        <div className="grid xl:grid-cols-[1.4fr_.8fr] gap-5 mt-5">
          <section className="panel overflow-hidden">
            <div className="p-5 flex justify-between items-start">
              <div>
                <div className="eyebrow">Fila de hoje</div>
                <h2 className="font-bold text-lg mt-2">Consultas e retornos</h2>
              </div>
              <span className="chip chip-red">
                {person.appointments.length} itens
              </span>
            </div>
            {person.appointments.length ? (
              <div className="table-wrap">
                <div className="table-row table-head bg-muted/40">
                  <span>Paciente</span>
                  <span>Data / hora</span>
                  <span>Status</span>
                  <span>Notas</span>
                  <span />
                </div>
                {person.appointments.map((a) => (
                  <div
                    className="table-row hover:bg-muted/30 transition-colors"
                    key={a.id}
                  >
                    <div className="flex gap-2 items-center">
                      <span
                        className="avatar w-8 h-8"
                        style={{ background: genderTone(person.gender) }}
                      >
                        {initials(a.patient)}
                      </span>
                      <b className="text-xs">{a.patient}</b>
                    </div>
                    <div>
                      <span className="block font-mono text-[11px] text-primary font-bold">
                        {a.time}
                      </span>
                      <span className="block text-[10px] text-muted-foreground mt-1">
                        {formatDate(a.date)}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        updatePerson({
                          ...person,
                          appointments: person.appointments.map((item) =>
                            item.id === a.id
                              ? {
                                  ...item,
                                  status:
                                    item.status === "confirmed"
                                      ? "pending"
                                      : "confirmed",
                                }
                              : item,
                          ),
                        })
                      }
                      className={`chip cursor-pointer hover:opacity-80 transition-opacity ${a.status === "confirmed" ? "chip-red" : a.status === "rescheduled" ? "chip-coral" : ""}`}
                    >
                      {a.status === "confirmed"
                        ? "✅ confirmado"
                        : a.status === "rescheduled"
                          ? "🔄 reagendar"
                          : "⏳ aguardando"}
                    </button>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {a.note || "—"}
                    </span>
                    <div className="flex gap-1 justify-end">
                      <button
                        className="button-ghost button-icon"
                        onClick={() => {
                          setEditing(a);
                          setShowForm(true);
                        }}
                        aria-label={`Editar ${a.patient}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="button-ghost button-icon !text-destructive"
                        onClick={() => setConfirmDeleteAppt(a)}
                        aria-label={`Excluir ${a.patient}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="Fila limpa"
                copy="Adicione consultas, retornos ou reagendamentos para dar forma ao seu dia."
                action="Adicionar encontro"
                onAction={() => setShowForm(true)}
              />
            )}
          </section>
          <ActivityPanel
            person={person}
            updatePerson={updatePerson}
            notify={notify}
          />
        </div>

        {/* PRIORITIES */}
        <div className="panel p-5 mt-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Próximo movimento</div>
              <h2 className="font-bold text-lg mt-2">Prioridades da jornada</h2>
            </div>
            <span className="chip chip-coral">
              <Sparkles size={12} /> foco
            </span>
          </div>
          <div className="grid md:grid-cols-3 gap-3 mt-5">
            <Priority
              icon={Phone}
              title={`${Math.max(0, person.goal - person.conversions)} conversões para a meta`}
              detail="Escolha 1 contato para começar"
              tone="coral"
            />
            <Priority
              icon={MessageCircle}
              title={`${person.whatsapp} conversas no WhatsApp`}
              detail="Retome as que ficaram abertas"
              tone="red"
            />
            <Priority
              icon={CalendarDays}
              title={
                person.appointments.length
                  ? "Agenda em movimento"
                  : "Monte sua primeira agenda"
              }
              detail="Atualize sempre que algo mudar"
              tone="gold"
            />
          </div>
        </div>
      </div>
      {showForm && (
        <AppointmentModal
          appointment={editing}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={(a) => {
            const next = editing
              ? person.appointments.map((item) => (item.id === a.id ? a : item))
              : [...person.appointments, a];
            updatePerson({
              ...person,
              appointments: next.sort((x, y) =>
                `${x.date}${x.time}`.localeCompare(`${y.date}${y.time}`),
              ),
            });
            setShowForm(false);
            setEditing(null);
            if (!editing) notify(`Novo agendamento: ${a.patient}`, "notify");
            else notify("Encontro atualizado.");
          }}
        />
      )}
      {showGoal && (
        <GoalModal
          person={person}
          onCancel={() => setShowGoal(false)}
          onSave={(goal) => {
            updatePerson({ ...person, goal });
            setShowGoal(false);
            notify(
              `Meta de ${person.name} atualizada para ${goal} conversões.`,
            );
          }}
        />
      )}
      <ConfirmDialog
        open={confirmDeleteAppt !== null}
        title="Excluir este encontro?"
        description={
          confirmDeleteAppt
            ? `Isso remove permanentemente o registro de ${confirmDeleteAppt.patient}. Essa ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Excluir"
        onCancel={() => setConfirmDeleteAppt(null)}
        onConfirm={() => {
          if (confirmDeleteAppt) removeAppt(confirmDeleteAppt.id);
          setConfirmDeleteAppt(null);
        }}
      />
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
            <p className="text-sm text-muted-foreground mt-3 max-w-lg">
              O que foi concluído fica guardado para orientar o próximo passo.
            </p>
          </div>
          <BackToMenu />
        </div>
        <div className="grid lg:grid-cols-[.9fr_1.1fr] gap-5 mt-9">
          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Histórico da equipe</h2>
              <span className="chip">
                {store.archives.length}{" "}
                {store.archives.length === 1 ? "dia" : "dias"}
              </span>
            </div>
            <div className="retention-note mt-4">
              <Clock3 size={14} />
              <span>
                Agendamentos e reagendamentos ficam aqui por{" "}
                {ARCHIVE_RETENTION_DAYS} dias. Depois, a limpeza é automática.
              </span>
            </div>
            {store.archives.length ? (
              <div className="space-y-2 mt-5">
                {store.archives.map((arc) => (
                  <button
                    key={arc.id}
                    onClick={() => setSelected(arc)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${selected?.id === arc.id ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted/50"}`}
                  >
                    <div className="flex items-center justify-between">
                      <b className="text-sm">{formatDate(arc.date)}</b>
                      <ChevronRight
                        size={15}
                        className="text-muted-foreground"
                      />
                    </div>
                    <div className="flex gap-3 text-[10px] text-muted-foreground mt-2">
                      <span>{arc.appointments.length} encontros</span>
                      <span>fechado às {arc.closedAt}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FileClock}
                title="Ainda não há dias arquivados"
                copy="Quando a equipe fechar o primeiro dia, o histórico aparecerá aqui."
              />
            )}
          </section>
          <section className="panel p-5 min-h-[330px]">
            {selected ? (
              <>
                <div className="eyebrow">Detalhes do fechamento</div>
                <h2 className="display-title text-4xl mt-2">
                  {formatDate(selected.date)}
                </h2>
                <p className="text-xs text-muted-foreground mt-2">
                  Encerrado às {selected.closedAt} · {selected.collaboratorName}
                </p>
                <div className="space-y-2 mt-7">
                  {selected.appointments.map((a) => (
                    <div
                      className="schedule-tile flex items-center gap-3"
                      key={a.id}
                    >
                      <span className="font-mono text-xs text-primary font-bold">
                        {a.time}
                      </span>
                      <span className="text-xs font-bold flex-1">
                        {a.patient}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {a.note}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                icon={FileClock}
                title="Selecione um dia"
                copy="Escolha um fechamento ao lado para revisar os encontros arquivados."
              />
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

/* ─── TRAINING ─── */
function Training({
  store,
  setStore,
  notify,
}: {
  store: Store;
  setStore: (s: Store) => void;
  notify: (m: string, k?: ToastKind) => void;
}) {
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("");
  const [area, setArea] = useState("Desenvolvimento");
  const active =
    store.collaborators.find((person) => person.id === store.activeId) ??
    store.collaborators[0];
  const ownerId = active?.id ?? "daniel";
  const summary = studySummary(store, ownerId);
  const highAttempts = summary.records.filter((t) => t.attempts >= 4);
  const toggle = (item: Training) => {
    const now = new Date().toISOString();
    setStore({
      ...store,
      training: store.training.map((t) =>
        t.id === item.id
          ? {
              ...t,
              watched: !t.watched,
              attempts: item.watched ? item.attempts : item.attempts + 1,
              completedAt: item.watched ? undefined : now,
            }
          : t,
      ),
    });
    notify(
      item.watched
        ? "Aula marcada como pendente."
        : "Aula concluída. Boa prática!",
    );
  };

  function registerStudy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTitle = title.trim();
    const durationMinutes = Math.round(Number(minutes));
    if (
      !normalizedTitle ||
      !Number.isFinite(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > 720
    ) {
      notify(
        "Informe o nome do vídeo e uma duração entre 1 e 720 minutos.",
        "notify",
      );
      return;
    }
    setStore({
      ...store,
      training: [
        {
          id: `study-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: normalizedTitle,
          durationMinutes,
          watched: false,
          attempts: 0,
          area: area.trim() || "Desenvolvimento",
          ownerId,
          createdAt: new Date().toISOString(),
        },
        ...store.training,
      ],
    });
    setTitle("");
    setMinutes("");
    notify("Vídeo registrado na sua trilha individual.");
  }

  return (
    <AppShell
      store={store}
      onToggleSound={() =>
        setStore({ ...store, soundEnabled: !store.soundEnabled })
      }
    >
      <div className="content-wrap">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <div className="eyebrow">Desenvolvimento contínuo</div>
            <h1 className="page-title mt-3">Treinar para cuidar.</h1>
            <p className="text-sm text-muted-foreground mt-3 max-w-lg">
              Trilha de {active?.name ?? "colaborador"}: cada vídeo e cada
              avanço ficam vinculados ao seu perfil.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="button-primary"
              onClick={() => {
                const next = summary.records.find((t) => !t.watched);
                if (next) toggle(next);
              }}
              disabled={!summary.records.some((t) => !t.watched)}
            >
              <Play size={15} /> Marcar próxima aula
            </button>
            <BackToMenu />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-9">
          <StatCard
            label="Aulas totais"
            value={`${summary.total}`}
            detail="no seu histórico"
            icon={Video}
          />
          <StatCard
            label="Assistidas"
            value={`${summary.watched}`}
            detail={`${summary.percentage}% do total`}
            icon={CheckCircle2}
            accent
          />
          <StatCard
            label="Restantes"
            value={`${summary.remaining}`}
            detail="para sua próxima pausa"
            icon={Clock3}
          />
          <StatCard
            label="Tempo registrado"
            value={formatMinutes(summary.minutes)}
            detail={`${summary.days} dias no histórico`}
            icon={GraduationCap}
          />
        </div>
        <div className="grid xl:grid-cols-[1.3fr_.7fr] gap-5 mt-5">
          <section className="panel overflow-hidden">
            <div className="p-5">
              <div className="eyebrow">Minha trilha</div>
              <h2 className="font-bold text-lg mt-2">Aulas para o dia a dia</h2>
            </div>
            {summary.records.length ? (
              summary.records.map((item) => (
                <div
                  className="flex items-center gap-4 p-4 md:p-5 border-t border-border hover:bg-muted/30 transition-colors"
                  key={item.id}
                >
                  <button
                    onClick={() => toggle(item)}
                    className={`w-9 h-9 rounded-full border grid place-items-center shrink-0 transition-all ${item.watched ? "bg-primary border-primary text-white" : "border-input text-transparent hover:text-primary hover:border-primary"}`}
                    aria-label={`${item.watched ? "Marcar pendente" : "Concluir"}: ${item.title}`}
                  >
                    <Check size={15} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-sm font-bold ${item.watched ? "line-through text-muted-foreground" : ""}`}
                    >
                      {item.title}
                    </div>
                    <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                      <span>{item.area}</span>
                      <span>{formatMinutes(item.durationMinutes)}</span>
                      <span>
                        {item.attempts} tentativa
                        {item.attempts === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <button
                    className="button-ghost button-icon"
                    onClick={() =>
                      notify(`Registrada como próxima aula: ${item.title}`)
                    }
                    aria-label={`Selecionar ${item.title}`}
                  >
                    <Play size={15} />
                  </button>
                </div>
              ))
            ) : (
              <EmptyState
                icon={Video}
                title="Sua trilha começa aqui"
                copy="Registre o primeiro vídeo com duração estimada para acompanhar sua evolução."
              />
            )}
          </section>
          <section className="panel p-5">
            <div className="study-brand-card">
              <img
                src="/brand/odonto-excellence-logo.png"
                alt="Odonto Excellence"
              />
              <span>Ambiente Videos</span>
            </div>
            <div className="eyebrow">Registrar vídeo</div>
            <h2 className="display-title text-3xl mt-2">
              Transforme tempo
              <br />
              <span className="text-primary">em avanço.</span>
            </h2>
            <form className="mt-6 space-y-3" onSubmit={registerStudy}>
              <label className="block">
                <span className="label-text">Nome do vídeo</span>
                <input
                  className="input-field"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ex.: Como conduzir uma avaliação"
                  maxLength={120}
                  required
                />
              </label>
              <div className="grid grid-cols-[.7fr_1.3fr] gap-3">
                <label className="block">
                  <span className="label-text">Minutos</span>
                  <input
                    className="input-field"
                    value={minutes}
                    onChange={(event) => setMinutes(event.target.value)}
                    inputMode="numeric"
                    type="number"
                    min="1"
                    max="720"
                    placeholder="12"
                    required
                  />
                </label>
                <label className="block">
                  <span className="label-text">Área</span>
                  <input
                    className="input-field"
                    value={area}
                    onChange={(event) => setArea(event.target.value)}
                    placeholder="Comercial"
                    maxLength={48}
                  />
                </label>
              </div>
              <button className="button-primary w-full" type="submit">
                <Plus size={15} /> Salvar na minha trilha
              </button>
            </form>
            <div className="mt-8">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-muted-foreground">Progresso geral</span>
                <b className="text-primary">
                  {summary.watched}/{summary.total}
                </b>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${summary.percentage}%` }}
                />
              </div>
            </div>
            <div className="border-t border-border mt-7 pt-5">
              <div className="flex gap-2 items-center">
                <BarChart3 size={16} className="text-accent" />
                <b className="text-xs">Para revisitar</b>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                {highAttempts.length
                  ? `${highAttempts.length} aulas tiveram mais tentativas. Vale voltar sem pressa.`
                  : "Nenhuma aula exige atenção extra agora."}
              </p>
              {highAttempts.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between mt-3 text-xs"
                >
                  <span className="truncate">{item.title}</span>
                  <span className="font-mono text-accent ml-2">
                    {item.attempts}x
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

/* ─── CHAT (preview, feature-flagged as not yet released) ─── */
const CHAT_LOCKED_MESSAGE = "Funcionalidade ainda não liberada pelo dev.";
const EMOJI_PICKER_OPTIONS = [
  "😀", "😁", "😂", "🙂", "😉", "😊", "😍", "🤔",
  "👍", "🙏", "👏", "🎉", "❤️", "🦷", "✅", "📅",
];

function ChatComposeLocked({ notify }: { notify: (m: string, k?: ToastKind) => void }) {
  const [draft, setDraft] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lock = () => notify(CHAT_LOCKED_MESSAGE, "notify");

  return (
    <div className="border-t border-border p-3 sm:p-4 bg-background">
      {showEmoji && (
        <div className="panel p-3 mb-2 grid grid-cols-8 gap-1 max-w-xs">
          {EMOJI_PICKER_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="text-lg hover:bg-muted rounded-md p-1.5"
              onClick={() => {
                setDraft((current) => current + emoji);
                setShowEmoji(false);
                lock();
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="button-ghost button-icon shrink-0"
          onClick={() => setShowEmoji((v) => !v)}
          aria-label="Emojis"
        >
          <Smile size={18} />
        </button>
        <button
          type="button"
          className="button-ghost button-icon shrink-0"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Anexar imagem"
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={() => {
            lock();
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />
        <input
          className="input-field flex-1"
          placeholder="Escreva uma mensagem..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPaste={(e) => {
            if (e.clipboardData.files.length > 0) lock();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              lock();
            }
          }}
        />
        <button
          type="button"
          className="button-primary button-icon shrink-0"
          onClick={lock}
          aria-label="Enviar mensagem"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

function ReadReceipt({ status }: { status: "sent" | "delivered" | "read" }) {
  if (status === "sent") return <Check size={12} className="shrink-0" />;
  return (
    <CheckCheck
      size={12}
      className={`shrink-0 ${status === "read" ? "text-sky-300" : ""}`}
    />
  );
}

type TeammatePresence = { id: string; displayName: string; online: boolean; lastSeenAt: string };

function Chat({ store, notify }: { store: Store; notify: (m: string, k?: ToastKind) => void }) {
  const [activeContactId, setActiveContactId] = useState<string | null>(
    store.collaborators[0]?.id ?? null,
  );
  const [presence, setPresence] = useState<Record<string, TeammatePresence>>({});
  const [showTypingDemo, setShowTypingDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadPresence() {
      try {
        const response = await fetch(
          `${PORTAL_API_URL}/odonto-portal/team/presence`,
          { credentials: "include", cache: "no-store" },
        );
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as { teammates: TeammatePresence[] };
        if (cancelled) return;
        setPresence(
          Object.fromEntries(body.teammates.map((t) => [t.id, t])),
        );
      } catch {
        // Presence is a nice-to-have; a failed fetch shouldn't break the screen.
      }
    }
    void loadPresence();
    const timer = window.setInterval(() => void loadPresence(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  // Illustrative only: cycles a "digitando..." indicator every few seconds so
  // people can see what the real thing will look like. No real typing signal
  // exists yet, since sending messages is still locked.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setShowTypingDemo((v) => !v);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [activeContactId]);

  const activeContact =
    store.collaborators.find((c) => c.id === activeContactId) ??
    store.collaborators[0];
  const activePresence = activeContact ? presence[activeContact.id] : undefined;

  const previewMessages = activeContact
    ? [
        {
          id: "m1",
          fromMe: false,
          text: `Oi! Aqui é a pré-visualização da conversa com ${activeContact.name}.`,
          time: "09:12",
          status: null as "sent" | "delivered" | "read" | null,
        },
        {
          id: "m2",
          fromMe: true,
          text: "Quando o recurso for liberado pelo desenvolvedor, as mensagens de verdade aparecem aqui.",
          time: "09:13",
          status: "read" as "sent" | "delivered" | "read" | null,
        },
      ]
    : [];

  return (
    <AppShell store={store} onToggleSound={() => {}}>
      <div className="content-wrap">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="eyebrow flex items-center gap-2">
              Comunicação da equipe
              <span className="chip-red !text-[10px]">Indisponível</span>
            </div>
            <h1 className="page-title mt-3">Chat privado.</h1>
          </div>
          <BackToMenu />
        </div>

        <Alert className="mt-6 !border-destructive/30 bg-destructive/5">
          <LockKeyhole className="text-destructive" size={18} />
          <AlertTitle>Envio de mensagens indisponível no momento</AlertTitle>
          <AlertDescription>
            O envio de mensagens, imagens e anexos está em desenvolvimento e
            não funciona ainda — nada digitado ou anexado aqui é entregue,
            armazenado ou visível para outra pessoa. Já está funcionando de
            verdade, porém, o status de presença da equipe: quem está online
            agora e o horário do último acesso de cada pessoa.
          </AlertDescription>
        </Alert>

        <div className="panel mt-9 overflow-hidden">
          <div className="grid md:grid-cols-[280px_1fr] h-[560px]">
            {/* Contact list */}
            <div className="border-r border-border overflow-y-auto">
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  <UsersRound size={14} /> Equipe
                </div>
              </div>
              {store.collaborators.map((person) => {
                const p = presence[person.id];
                return (
                  <button
                    key={person.id}
                    onClick={() => setActiveContactId(person.id)}
                    className={`w-full flex items-center gap-3 p-3 text-left border-b border-border/50 transition-colors ${
                      activeContactId === person.id
                        ? "bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="relative shrink-0">
                      <span className="w-9 h-9 rounded-full bg-primary/15 text-primary grid place-items-center font-bold text-sm">
                        {person.name.charAt(0).toUpperCase()}
                      </span>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${
                          p?.online ? "bg-emerald-500" : "bg-muted-foreground/40"
                        }`}
                        aria-label={p?.online ? "Online" : "Offline"}
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold truncate">
                        {person.name}
                      </span>
                      <span className="block text-[11px] text-muted-foreground truncate">
                        {p?.online
                          ? "Online agora"
                          : p?.lastSeenAt
                            ? `Visto por último ${formatLastSeen(p.lastSeenAt)}`
                            : person.role}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Thread */}
            <div className="flex flex-col min-w-0">
              <div className="p-4 border-b border-border flex items-center gap-3">
                {activeContact ? (
                  <>
                    <span className="relative shrink-0">
                      <span className="w-8 h-8 rounded-full bg-primary/15 text-primary grid place-items-center font-bold text-xs">
                        {activeContact.name.charAt(0).toUpperCase()}
                      </span>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-background ${
                          activePresence?.online
                            ? "bg-emerald-500"
                            : "bg-muted-foreground/40"
                        }`}
                      />
                    </span>
                    <div className="min-w-0">
                      <span className="block font-bold text-sm truncate">
                        {activeContact.name}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {activePresence?.online
                          ? "online agora"
                          : activePresence?.lastSeenAt
                            ? `visto por último ${formatLastSeen(activePresence.lastSeenAt)}`
                            : "presença indisponível"}
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Nenhum contato disponível
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
                <div className="flex flex-col items-center gap-1">
                  <span className="chip !text-[10px]">
                    Mensagens abaixo: pré-visualização de layout, nada é
                    enviado de fato
                  </span>
                  <span className="chip !text-[10px] !bg-emerald-500/10 !text-emerald-700 !border-emerald-500/25">
                    Status online/offline e "visto por último": dados reais
                  </span>
                </div>
                {previewMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                        m.fromMe
                          ? "bg-primary text-white rounded-br-sm"
                          : "bg-background border border-border rounded-bl-sm"
                      }`}
                    >
                      <p>{m.text}</p>
                      <span
                        className={`flex items-center gap-1 justify-end text-[10px] mt-1 ${m.fromMe ? "text-white/70" : "text-muted-foreground"}`}
                      >
                        {m.time}
                        {m.fromMe && m.status && (
                          <ReadReceipt status={m.status} />
                        )}
                      </span>
                    </div>
                  </div>
                ))}
                {showTypingDemo && activeContact && (
                  <div className="flex justify-start">
                    <div className="bg-background border border-border rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2">
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" />
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        exemplo: indicador de digitação
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <ChatComposeLocked notify={notify} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/* ─── SETTINGS ─── */
function Settings({
  store,
  setStore,
  notify,
}: {
  store: Store;
  setStore: (s: Store) => void;
  notify: (m: string, k?: ToastKind) => void;
}) {
  const portalUser = useContext(PortalAuthContext);
  const [showProfile, setShowProfile] = useState(false);
  const [goalPerson, setGoalPerson] = useState<Collaborator | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function clearData() {
    localStorage.removeItem(PORTAL_STORAGE_KEY);
    setStore({
      collaborators: initialCollaborators,
      archives: [],
      training: initialTraining,
      studyBaselines: initialStudyBaselines,
      activeId: "daniel",
      activeDate: today,
      soundEnabled: true,
      preferences: {
        compactMode: false,
        privacyMode: false,
        dailyTips: true,
        autoRefresh: true,
      },
    });
    setConfirmReset(false);
    notify("Dados restaurados para o exemplo inicial.");
  }

  return (
    <AppShell
      store={store}
      onToggleSound={() =>
        setStore({ ...store, soundEnabled: !store.soundEnabled })
      }
    >
      <div className="content-wrap">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Controle da equipe</div>
            <h1 className="page-title mt-3">Configurações da rotina.</h1>
            <p className="text-sm text-muted-foreground mt-3 max-w-lg">
              Ajuste os perfis e mantenha a operação da equipe alinhada em um
              único ambiente.
            </p>
          </div>
          <BackToMenu />
        </div>

        {/* SOUND SETTING */}
        <section className="panel p-5 md:p-7 mt-9">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex gap-3 items-start">
              <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                {store.soundEnabled ? (
                  <Volume2 size={17} />
                ) : (
                  <VolumeX size={17} />
                )}
              </span>
              <div>
                <h2 className="font-bold text-sm">Notificações com som</h2>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Som ativado para novos agendamentos. A notificação aparece
                  para todos em tempo real.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setStore({ ...store, soundEnabled: !store.soundEnabled });
                notify(store.soundEnabled ? "Som desativado." : "Som ativado!");
              }}
              className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${store.soundEnabled ? "bg-primary text-white" : "button-secondary"}`}
            >
              {store.soundEnabled ? "🔔 Som ativo" : "🔕 Som desativado"}
            </button>
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-5 mt-5">
          <div className="panel p-5 md:p-7">
            <div className="flex gap-3 items-start">
              <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <SlidersHorizontal size={17} />
              </span>
              <div>
                <h2 className="font-bold text-sm">Experiência do portal</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Preferências pessoais sincronizadas neste ambiente.
                </p>
              </div>
            </div>
            <div className="space-y-3 mt-6">
              {(
                [
                  [
                    "compactMode",
                    "Visual compacto",
                    "Exibe mais informações em telas menores.",
                  ],
                  [
                    "dailyTips",
                    "Dicas de desempenho",
                    "Mostra orientações baseadas na rotina do dia.",
                  ],
                  [
                    "autoRefresh",
                    "Atualização automática",
                    "Mantém os dados da equipe atualizados.",
                  ],
                  [
                    "privacyMode",
                    "Modo de privacidade",
                    "Oculta informações sensíveis em áreas compartilhadas.",
                  ],
                ] as [keyof PortalPreferences, string, string][]
              ).map(([key, label, copy]) => (
                <label key={key} className="preference-row">
                  <span>
                    <b>{label}</b>
                    <small>{copy}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={store.preferences[key]}
                    onChange={() => {
                      setStore({
                        ...store,
                        preferences: {
                          ...store.preferences,
                          [key]: !store.preferences[key],
                        },
                      });
                      notify(
                        `${label} ${store.preferences[key] ? "desativado" : "ativado"}.`,
                      );
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="panel p-5 md:p-7">
            <div className="flex gap-3 items-start">
              <span className="w-9 h-9 rounded-lg bg-accent/15 text-accent grid place-items-center">
                <ShieldCheck size={17} />
              </span>
              <div>
                <h2 className="font-bold text-sm">Conta e segurança</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Proteções do seu acesso ao portal.
                </p>
              </div>
            </div>
            <div className="account-summary mt-6">
              <span className="avatar w-11 h-11">
                {initials(portalUser?.displayName ?? "OE")}
              </span>
              <div>
                <b>{portalUser?.displayName}</b>
                <small>
                  @{portalUser?.username} ·{" "}
                  {portalUser?.accountType === "creator"
                    ? "Criador"
                    : portalUser?.accountType === "manager"
                      ? "Gerente"
                      : portalUser?.accountType === "individual"
                        ? "Individual"
                        : "Equipe"}
                </small>
              </div>
              <span className="chip chip-red ml-auto">
                <ShieldCheck size={11} /> protegida
              </span>
            </div>
            <button
              className="button-secondary w-full mt-5"
              onClick={() => setShowPassword(true)}
            >
              <LockKeyhole size={14} /> Alterar minha senha
            </button>
          </div>
        </section>

        {/* TEAM */}
        <section className="panel p-5 md:p-7 mt-5">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <div className="eyebrow">Equipe da clínica</div>
              <h2 className="font-bold text-lg mt-2">Perfis ativos</h2>
              <p className="text-xs text-muted-foreground mt-2">
                A cor de cada avatar acompanha a apresentação escolhida.
              </p>
            </div>
            <button
              className="button-primary self-start"
              onClick={() => setShowProfile(true)}
            >
              <Plus size={15} /> Novo perfil
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-3 mt-7">
            {store.collaborators.map((p) => (
              <div
                className="border border-border rounded-xl p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                key={p.id}
              >
                <span
                  className="avatar w-10 h-10"
                  style={{ background: genderTone(p.gender) }}
                >
                  {initials(p.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <b className="text-sm block">{p.name}</b>
                  <span className="text-[10px] text-muted-foreground">
                    {p.role} · {p.city}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="chip">
                    <Target size={11} /> {p.goal}/dia
                  </span>
                  <button
                    type="button"
                    className="button-ghost button-icon"
                    onClick={() => setGoalPerson(p)}
                    aria-label={`Editar meta de ${p.name}`}
                    title={`Editar meta de ${p.name}`}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* DATA */}
        <section className="grid md:grid-cols-2 gap-5 mt-5">
          <div className="panel p-5">
            <div className="flex gap-3">
              <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                <ShieldCheck size={17} />
              </span>
              <div>
                <h2 className="font-bold text-sm">Dados da equipe</h2>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Agenda, metas, histórico e progresso são mantidos no ambiente
                  compartilhado da equipe.
                </p>
                <span className="chip chip-red mt-4 inline-flex">
                  <CheckCircle2 size={12} /> sincronização ativa
                </span>
              </div>
            </div>
          </div>
          <div className="panel p-5">
            <div className="flex gap-3">
              <span className="w-9 h-9 rounded-lg bg-accent/15 text-accent grid place-items-center shrink-0">
                <RotateCcw size={17} />
              </span>
              <div>
                <h2 className="font-bold text-sm">Começar de novo</h2>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Restaure os dados de exemplo para iniciar uma nova rotina da
                  equipe.
                </p>
                <button
                  className="button-danger mt-4"
                  onClick={() => setConfirmReset(true)}
                >
                  Restaurar dados iniciais
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
      {showProfile && (
        <ProfileModal
          onCancel={() => setShowProfile(false)}
          onSave={(p) => {
            setStore({ ...store, collaborators: [...store.collaborators, p] });
            setShowProfile(false);
            notify(`${p.name} entrou para a equipe.`);
          }}
        />
      )}
      {goalPerson && (
        <GoalModal
          person={goalPerson}
          onCancel={() => setGoalPerson(null)}
          onSave={(goal) => {
            setStore({
              ...store,
              collaborators: store.collaborators.map((person) =>
                person.id === goalPerson.id ? { ...person, goal } : person,
              ),
            });
            notify(
              `Meta de ${goalPerson.name} atualizada para ${goal} conversões.`,
            );
            setGoalPerson(null);
          }}
        />
      )}
      {confirmReset && (
        <div className="modal-backdrop">
          <div className="modal-card p-7">
            <div className="flex justify-between">
              <span className="w-11 h-11 rounded-xl bg-accent/15 text-accent grid place-items-center">
                <RotateCcw size={19} />
              </span>
              <button
                onClick={() => setConfirmReset(false)}
                className="button-ghost button-icon"
              >
                <X size={17} />
              </button>
            </div>
            <h2 className="display-title text-3xl mt-6">
              Restaurar dados iniciais?
            </h2>
            <p className="text-sm text-muted-foreground mt-3">
              O histórico e as alterações atuais serão substituídos pelos dados
              de exemplo.
            </p>
            <div className="flex justify-end gap-2 mt-7">
              <button
                className="button-secondary"
                onClick={() => setConfirmReset(false)}
              >
                Manter meus dados
              </button>
              <button className="button-danger" onClick={clearData}>
                Restaurar agora
              </button>
            </div>
          </div>
        </div>
      )}
      {showPassword && (
        <PasswordChangeModal
          required={false}
          onCancel={() => setShowPassword(false)}
          onChanged={() => {
            setShowPassword(false);
          }}
          notify={notify}
        />
      )}
    </AppShell>
  );
}

function PasswordChangeModal({
  required,
  onChanged,
  onCancel,
  notify,
}: {
  required: boolean;
  onChanged: (user: PortalUser) => void;
  onCancel?: () => void;
  notify: (message: string, kind?: ToastKind) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      notify("As novas senhas não coincidem.", "notify");
      return;
    }
    if (
      newPassword.length < 8 ||
      !/[A-Za-z]/.test(newPassword) ||
      !/\d/.test(newPassword)
    ) {
      notify("Use ao menos 8 caracteres, com letra e número.", "notify");
      return;
    }
    setBusy(true);
    const response = await fetch(
      `${PORTAL_API_URL}/odonto-portal/auth/password`,
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      },
    );
    const result = (await response.json().catch(() => ({}))) as {
      user?: PortalUser;
      error?: string;
    };
    setBusy(false);
    if (!response.ok || !result.user) {
      notify(result.error || "Não foi possível alterar a senha.", "notify");
      return;
    }
    onChanged(result.user);
    notify("Senha alterada com segurança.");
  }
  return (
    <div className="modal-backdrop z-[80]">
      <form className="modal-card p-7" onSubmit={submit}>
        <div className="flex justify-between">
          <span className="w-11 h-11 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <LockKeyhole size={20} />
          </span>
          {!required && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="button-ghost button-icon"
            >
              <X size={17} />
            </button>
          )}
        </div>
        <div className="eyebrow mt-6">
          {required ? "Primeiro acesso" : "Segurança da conta"}
        </div>
        <h2 className="display-title text-3xl mt-2">Crie sua senha pessoal.</h2>
        <p className="text-sm text-muted-foreground mt-3">
          {required
            ? "A senha temporária deve ser substituída antes de continuar. Essa etapa protege o seu ambiente."
            : "Altere sua senha atual e encerre as sessões anteriores."}
        </p>
        <label className="block mt-6">
          <span className="label-text">Senha atual</span>
          <input
            className="input-field"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </label>
        <label className="block mt-4">
          <span className="label-text">Nova senha</span>
          <input
            className="input-field"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
          <small className="text-[10px] text-muted-foreground">
            Mínimo de 8 caracteres, com letra e número.
          </small>
        </label>
        <label className="block mt-4">
          <span className="label-text">Confirmar nova senha</span>
          <input
            className="input-field"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <button className="button-primary w-full mt-6" disabled={busy}>
          <ShieldCheck size={15} />{" "}
          {busy ? "Protegendo conta..." : "Salvar nova senha"}
        </button>
      </form>
    </div>
  );
}

/* ─── ADMINISTRATION ─── */
function Admin({
  store,
  notify,
}: {
  store: Store;
  notify: (message: string, kind?: ToastKind) => void;
}) {
  const portalUser = useContext(PortalAuthContext);
  const [users, setUsers] = useState<
    Array<
      PortalUser & {
        createdAt: string;
        lastSeenAt: string;
        lastLoginAt: string | null;
        online: boolean;
        summary: {
          collaborators: number;
          calls: number;
          messages: number;
          whatsapp: number;
          conversions: number;
          refusals: number;
          appointments: number;
        };
      }
    >
  >([]);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [noticeTargetId, setNoticeTargetId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [newPasswords, setNewPasswords] = useState<Record<string, string>>({});
  const [newAccount, setNewAccount] = useState({
    displayName: "",
    username: "",
    password: "",
    accountType: "individual" as PortalAccountType,
  });
  const [confirmAction, setConfirmAction] = useState<{
    userId: string;
    displayName: string;
    kind: "suspend" | "reject";
  } | null>(null);
  const [chatEnabled, setChatEnabled] = useState(false);
  const [savingChatToggle, setSavingChatToggle] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);

  const [loadingUsers, setLoadingUsers] = useState(true);
  const loadUsers = useCallback(async () => {
    const response = await fetch(
      `${PORTAL_API_URL}/odonto-portal/admin/users`,
      { credentials: "include" },
    );
    if (!response.ok) throw new Error("Não foi possível atualizar a lista.");
    const result = (await response.json()) as { users: typeof users };
    setUsers(result.users);
  }, []);
  const canManage =
    portalUser?.accountType === "creator" ||
    portalUser?.accountType === "manager";
  useEffect(() => {
    if (canManage)
      void loadUsers()
        .catch((error: Error) => notify(error.message, "notify"))
        .finally(() => setLoadingUsers(false));
    else setLoadingUsers(false);
  }, [canManage, loadUsers, notify]);
  useEffect(() => {
    void fetch(`${PORTAL_API_URL}/odonto-portal/settings`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { chatEnabled?: boolean } | null) => {
        if (body) setChatEnabled(body.chatEnabled === true);
      })
      .catch(() => undefined);
  }, []);
  if (!canManage || !portalUser) return <NotFound />;
  const currentManager = portalUser;

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    const accountType: PortalAccountType =
      currentManager.accountType === "manager"
        ? "member"
        : newAccount.accountType;
    const response = await fetch(
      `${PORTAL_API_URL}/odonto-portal/admin/users`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newAccount, accountType }),
      },
    );
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) {
      notify(result.error || "Não foi possível criar a conta.", "notify");
      return;
    }
    setNewAccount({
      displayName: "",
      username: "",
      password: "",
      accountType:
        currentManager.accountType === "creator" ? "individual" : "member",
    });
    await loadUsers();
    notify(
      accountType === "manager"
        ? "Gerente criado com ambiente de equipe."
        : accountType === "individual"
          ? "Usuário criado com ambiente privado."
          : "Colaborador adicionado ao ambiente da equipe.",
    );
  }

  async function resetPassword(userId: string) {
    const password = newPasswords[userId] ?? "";
    if (password.length < 8) {
      notify("A nova senha precisa ter ao menos 8 caracteres.", "notify");
      return;
    }
    const response = await fetch(
      `${PORTAL_API_URL}/odonto-portal/admin/users/${userId}/password`,
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      },
    );
    if (!response.ok) {
      notify("Não foi possível atualizar essa senha.", "notify");
      return;
    }
    setNewPasswords((current) => ({ ...current, [userId]: "" }));
    notify("Senha atualizada. As sessões desta conta foram encerradas.");
  }
  async function sendNotice(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(
      `${PORTAL_API_URL}/odonto-portal/admin/notifications`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          userId: noticeTargetId || undefined,
        }),
      },
    );
    if (!response.ok) {
      notify("Não foi possível enviar o aviso.", "notify");
      return;
    }
    setTitle("");
    setBody("");
    setNoticeTargetId("");
    notify("Notificação enviada ao portal.");
  }

  async function updateAccount(
    userId: string,
    patch: {
      displayName?: string;
      isActive?: boolean;
      accountStatus?: PortalAccountStatus;
      accountType?: PortalAccountType;
      teamMemberLimit?: number;
    },
    silent = false,
  ) {
    const response = await fetch(
      `${PORTAL_API_URL}/odonto-portal/admin/users/${userId}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      },
    );
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) {
      notify(result.error || "Não foi possível atualizar a conta.", "notify");
      return;
    }
    if (silent) return;
    await loadUsers();
    notify("Configurações da conta atualizadas.");
  }

  const managedAccounts = users.filter((account) => account.id !== portalUser.id);
  const pendingAccounts = managedAccounts.filter(
    (account) => account.accountStatus === "pending",
  );
  const activeAccounts = managedAccounts.filter(
    (account) => account.accountStatus !== "pending",
  );

  async function toggleChatFeature() {
    if (portalUser?.accountType !== "creator") return;
    setSavingChatToggle(true);
    try {
      const response = await fetch(
        `${PORTAL_API_URL}/odonto-portal/admin/settings`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatEnabled: !chatEnabled }),
        },
      );
      const result = (await response.json().catch(() => ({}))) as {
        chatEnabled?: boolean;
        error?: string;
      };
      if (!response.ok) {
        notify(result.error || "Não foi possível salvar.", "notify");
        return;
      }
      setChatEnabled(result.chatEnabled === true);
      notify(
        result.chatEnabled
          ? "Chat sinalizado como liberado. O desenvolvimento do recurso continua em andamento."
          : "Chat marcado como indisponível.",
      );
    } finally {
      setSavingChatToggle(false);
    }
  }

  async function bulkApprovePending() {
    if (!pendingAccounts.length) return;
    setBulkApproving(true);
    try {
      for (const account of pendingAccounts) {
        await updateAccount(account.id, { accountStatus: "active" }, true);
      }
      await loadUsers();
      notify(
        `${pendingAccounts.length} ${pendingAccounts.length === 1 ? "pedido aprovado" : "pedidos aprovados"}.`,
      );
    } finally {
      setBulkApproving(false);
    }
  }
  const visibleUsers = activeAccounts.filter((account) =>
    `${account.displayName} ${account.username}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const selectedUser =
    users.find((account) => account.id === selectedUserId) ?? null;

  return (
    <AppShell store={store} onToggleSound={() => undefined}>
      <div className="content-wrap">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-8">
          <div>
            <div className="eyebrow">
              {portalUser.accountType === "creator"
                ? "Painel do criador"
                : "Gestão da equipe"}
            </div>
            <h1 className="page-title mt-3">Usuários e ambientes.</h1>
            <p className="text-sm text-muted-foreground mt-3">
              {portalUser.accountType === "creator"
                ? "Crie gerentes com equipes ou usuários com ambientes privados."
                : "Crie acessos para colaboradores do seu ambiente compartilhado."}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="button-secondary"
              onClick={() => {
                const header = [
                  "nome",
                  "usuario",
                  "tipo",
                  "status",
                  "ativo",
                  "criado_em",
                  "ultimo_acesso",
                ];
                const rows = managedAccounts.map((account) => [
                  account.displayName,
                  account.username,
                  account.accountType,
                  account.accountStatus,
                  account.isActive ? "sim" : "não",
                  account.createdAt,
                  account.lastLoginAt ?? "",
                ]);
                const csv = [header, ...rows]
                  .map((row) =>
                    row
                      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
                      .join(","),
                  )
                  .join("\n");
                const blob = new Blob([csv], {
                  type: "text/csv;charset=utf-8;",
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `odonto-excellence-usuarios-${localDateKey()}.csv`;
                link.click();
                URL.revokeObjectURL(url);
                notify("Exportação gerada.");
              }}
            >
              <FileClock size={14} /> Exportar CSV
            </button>
            <button
              className="button-secondary"
              onClick={() => {
                setLoadingUsers(true);
                void loadUsers().finally(() => setLoadingUsers(false));
              }}
              disabled={loadingUsers}
            >
              <RotateCcw size={14} className={loadingUsers ? "animate-spin" : ""} />{" "}
              Atualizar
            </button>
          </div>
        </div>
        <div className="admin-kpi-grid mb-6">
          <StatCard
            label="Contas ativas"
            value={`${managedAccounts.filter((u) => u.isActive).length}`}
            detail={`${managedAccounts.length} gerenciáveis`}
            icon={UsersRound}
          />
          <StatCard
            label="Agora no portal"
            value={`${managedAccounts.filter((u) => u.online).length}`}
            detail="atividade nos últimos 90s"
            icon={Zap}
            accent
          />
          <StatCard
            label="Gerentes"
            value={`${managedAccounts.filter((u) => u.accountType === "manager").length}`}
            detail="ambientes de equipe"
            icon={Building2}
          />
          <StatCard
            label="Pedidos"
            value={`${pendingAccounts.length}`}
            detail="aguardando aprovação"
            icon={LockKeyhole}
          />
        </div>
        <div className="panel p-5 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <MessageCircle size={16} className="text-primary" />
                <h2 className="font-bold text-sm">Chat ao vivo da equipe</h2>
                <span className="chip !bg-amber-500/15 !text-amber-600 !border-amber-500/30 !text-[10px]">
                  Em desenvolvimento
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-md">
                Controla se o portal sinaliza o chat como "liberado" para a
                equipe. O recurso de mensagens em si (envio, fotos, emojis)
                ainda está em desenvolvimento pelo dev e continua indisponível
                para todos, independente deste botão.
              </p>
            </div>
            {portalUser.accountType === "creator" ? (
              <button
                className={chatEnabled ? "button-primary" : "button-secondary"}
                onClick={() => void toggleChatFeature()}
                disabled={savingChatToggle}
              >
                {savingChatToggle ? (
                  "Salvando..."
                ) : chatEnabled ? (
                  <>
                    <Check size={14} /> Sinalizado como liberado
                  </>
                ) : (
                  <>
                    <Ban size={14} /> Liberar chat ao vivo
                  </>
                )}
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">
                Somente o criador controla este recurso.
              </span>
            )}
          </div>
          {pendingAccounts.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-5 pt-5 border-t border-border">
              <div>
                <h2 className="font-bold text-sm">Pedidos em massa</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Aprova todos os {pendingAccounts.length}{" "}
                  {pendingAccounts.length === 1 ? "pedido pendente" : "pedidos pendentes"} como
                  ambientes individuais. Você pode promover a gerente depois, um por um.
                </p>
              </div>
              <button
                className="button-secondary"
                onClick={() => void bulkApprovePending()}
                disabled={bulkApproving}
              >
                <Check size={14} />{" "}
                {bulkApproving ? "Aprovando..." : `Aprovar todos (${pendingAccounts.length})`}
              </button>
            </div>
          )}
        </div>
        <div className="grid xl:grid-cols-[1.45fr_.8fr] gap-6">
          <section className="panel overflow-hidden">
            <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-bold">Contas cadastradas</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Online nos últimos 90 segundos.
                </p>
              </div>
              <span className="chip-red">
                {managedAccounts.filter((u) => u.online).length} online
              </span>
              <label className="admin-search relative">
                <Search size={14} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar nome ou usuário"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  name="admin-account-filter"
                  data-1p-ignore
                  data-lpignore="true"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Limpar busca"
                    className="button-ghost button-icon !w-6 !h-6 absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X size={12} />
                  </button>
                )}
              </label>
            </div>
            {pendingAccounts.length > 0 && (
              <div className="admin-request-strip">
                <div className="eyebrow">Pedidos de acesso</div>
                {pendingAccounts.map((account) => (
                  <div key={account.id} className="admin-request-row">
                    <span className="avatar w-9 h-9">
                      {initials(account.displayName)}
                    </span>
                    <div className="min-w-0">
                      <b>{account.displayName}</b>
                      <small>
                        @{account.username} ·{" "}
                        {account.accountType === "manager"
                          ? "Gerente com equipe"
                          : "Individual privado"}
                      </small>
                    </div>
                    <button
                      className="button-secondary ml-auto"
                      onClick={() => setSelectedUserId(account.id)}
                    >
                      <ShieldCheck size={14} /> Configurar
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="divide-y divide-border">
              {loadingUsers ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Carregando contas...
                </div>
              ) : (
                <>
                  {visibleUsers.length === 0 && (
                    <div className="p-8 text-center">
                      <p className="text-sm font-bold text-muted-foreground">
                        {search
                          ? `Nenhuma conta encontrada para "${search}".`
                          : "Nenhuma conta cadastrada ainda."}
                      </p>
                      {search && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Sua própria conta de administrador não aparece
                          nesta lista. Verifique se digitou o nome
                          corretamente ou limpe a busca para ver todas as
                          contas.
                        </p>
                      )}
                    </div>
                  )}
                  {visibleUsers.map((account) => (
                    <div key={account.id} className="p-5">
                      <div className="flex gap-3 items-center">
                        <span className="avatar w-10 h-10">
                          {initials(account.displayName)}
                    </span>
                    <div className="min-w-0">
                      <b className="text-sm block">{account.displayName}</b>
                      <span className="text-xs text-muted-foreground">
                        @{account.username} ·{" "}
                        {account.accountType === "creator"
                          ? "Criador"
                          : account.accountType === "manager"
                            ? "Gerente"
                            : account.accountType === "member"
                              ? "Equipe"
                              : "Individual"}
                      </span>
                    </div>
                    <span
                      className={`ml-auto text-[10px] font-bold ${account.online ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {account.online ? "ONLINE" : "OFFLINE"}
                    </span>
                    {!account.isActive && (
                      <span className="chip">BLOQUEADO</span>
                    )}
                    <button
                      className="button-secondary"
                      onClick={() => setSelectedUserId(account.id)}
                    >
                      <Eye size={14} /> Perfil
                    </button>
                  </div>
                  <div className="admin-mini-metrics">
                    <span>
                      <b>{account.summary?.calls ?? 0}</b> ligações
                    </span>
                    <span>
                      <b>{account.summary?.conversions ?? 0}</b> conversões
                    </span>
                    <span>
                      <b>{account.summary?.refusals ?? 0}</b> recusas
                    </span>
                    <span>
                      <b>{account.summary?.appointments ?? 0}</b> agenda
                    </span>
                  </div>
                  {account.id !== portalUser.id && (
                    <div className="flex gap-2 mt-4">
                      <input
                        className="input-field"
                        type="password"
                        placeholder="Nova senha"
                        value={newPasswords[account.id] ?? ""}
                        onChange={(e) =>
                          setNewPasswords((current) => ({
                            ...current,
                            [account.id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        className="button-secondary shrink-0"
                        onClick={() => void resetPassword(account.id)}
                      >
                        Atualizar senha
                      </button>
                    </div>
                  )}
                </div>
              ))}
                </>
              )}
            </div>
          </section>
          <div className="space-y-5 self-start">
            <form className="panel p-6" onSubmit={createAccount}>
              <div className="eyebrow">Novo acesso</div>
              <h2 className="display-title text-3xl mt-3">Criar usuário.</h2>
              <p className="text-xs text-muted-foreground mt-2">
                {portalUser.accountType === "creator"
                  ? "Escolha entre um gerente com equipe ou um ambiente individual."
                  : "O novo usuário compartilhará o ambiente da sua equipe."}
              </p>
              <label className="block mt-6">
                <span className="label-text">Nome</span>
                <input
                  className="input-field"
                  value={newAccount.displayName}
                  onChange={(e) =>
                    setNewAccount((current) => ({
                      ...current,
                      displayName: e.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="block mt-4">
                <span className="label-text">Usuário</span>
                <input
                  className="input-field"
                  value={newAccount.username}
                  onChange={(e) =>
                    setNewAccount((current) => ({
                      ...current,
                      username: e.target.value,
                    }))
                  }
                  minLength={3}
                  maxLength={32}
                  pattern="[A-Za-z0-9._-]+"
                  required
                />
              </label>
              <label className="block mt-4">
                <span className="label-text">Senha inicial</span>
                <input
                  className="input-field"
                  type="password"
                  value={newAccount.password}
                  onChange={(e) =>
                    setNewAccount((current) => ({
                      ...current,
                      password: e.target.value,
                    }))
                  }
                  minLength={8}
                  required
                />
              </label>
              {portalUser.accountType === "creator" && (
                <label className="block mt-4">
                  <span className="label-text">Tipo de ambiente</span>
                  <select
                    className="input-field"
                    value={newAccount.accountType}
                    onChange={(e) =>
                      setNewAccount((current) => ({
                        ...current,
                        accountType: e.target.value as PortalAccountType,
                      }))
                    }
                  >
                    <option value="individual">Individual e privado</option>
                    <option value="manager">Gerente com equipe</option>
                  </select>
                </label>
              )}
              <button className="button-primary w-full mt-5">
                <Plus size={14} /> Criar acesso
              </button>
            </form>
            {
              <form className="panel p-6" onSubmit={sendNotice}>
                <div className="eyebrow">Central de comunicação</div>
                <label className="block mt-4">
                  <span className="label-text">Destinatário</span>
                  <select
                    className="input-field"
                    value={noticeTargetId}
                    onChange={(e) => setNoticeTargetId(e.target.value)}
                  >
                    <option value="">
                      {portalUser.accountType === "creator"
                        ? "Todos os usuários"
                        : "Toda a minha equipe"}
                    </option>
                    {users
                      .filter((u) => u.id !== portalUser.id && u.isActive)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.displayName} (@{u.username})
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block mt-4">
                  <span className="label-text">Título</span>
                  <input
                    className="input-field"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </label>
                <label className="block mt-4">
                  <span className="label-text">Mensagem</span>
                  <textarea
                    className="textarea-field min-h-24"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                  />
                </label>
                <button className="button-secondary w-full mt-5">
                  Enviar comunicado
                </button>
              </form>
            }
          </div>
        </div>
      </div>
      {selectedUser && (
        <div className="modal-backdrop">
          <div className="modal-card p-7 admin-profile-modal">
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <span className="avatar w-12 h-12">
                  {initials(selectedUser.displayName)}
                </span>
                <div>
                  <div className="eyebrow">Acesso rápido</div>
                  <h2 className="font-bold text-xl mt-1">
                    {selectedUser.displayName}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    @{selectedUser.username} · {selectedUser.accountType}
                  </p>
                  {selectedUser.accountStatus === "pending" && (
                    <span className="chip-coral mt-2 inline-flex">
                      Aguardando aprovação
                    </span>
                  )}
                </div>
              </div>
              <button
                className="button-ghost button-icon"
                onClick={() => setSelectedUserId(null)}
              >
                <X size={17} />
              </button>
            </div>
            <div className="admin-profile-stats mt-6">
              {Object.entries(selectedUser.summary ?? {}).map(
                ([key, value]) => (
                  <div key={key}>
                    <b>{value}</b>
                    <span>
                      {
                        {
                          collaborators: "equipe",
                          calls: "ligações",
                          messages: "mensagens",
                          whatsapp: "WhatsApp",
                          conversions: "conversões",
                          refusals: "recusas",
                          appointments: "agenda",
                        }[key as keyof typeof selectedUser.summary]
                      }
                    </span>
                  </div>
                ),
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mt-6">
              <label>
                <span className="label-text">Nome exibido</span>
                <input
                  className="input-field"
                  defaultValue={selectedUser.displayName}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value && value !== selectedUser.displayName)
                      void updateAccount(selectedUser.id, {
                        displayName: value,
                      });
                  }}
                />
              </label>
              {portalUser.accountType === "creator" &&
                selectedUser.accountType !== "creator" && (
                  <label>
                    <span className="label-text">Tipo de ambiente</span>
                    <select
                      className="input-field"
                      defaultValue={selectedUser.accountType}
                      onChange={(e) =>
                        void updateAccount(selectedUser.id, {
                          accountType: e.target.value as PortalAccountType,
                        })
                      }
                    >
                      <option value="individual">
                        Individual e privado
                      </option>
                      <option value="manager">Gerente com equipe</option>
                    </select>
                  </label>
                )}
              {selectedUser.accountType === "manager" && (
                <label>
                  <span className="label-text">Limite da equipe</span>
                  <input
                    className="input-field"
                    type="number"
                    min="1"
                    max="999"
                    defaultValue={selectedUser.teamMemberLimit}
                    onBlur={(e) =>
                      void updateAccount(selectedUser.id, {
                        teamMemberLimit: Number(e.target.value),
                      })
                    }
                  />
                </label>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-6">
              {selectedUser.accountStatus === "pending" ? (
                <>
                  <button
                    className="button-primary"
                    onClick={() =>
                      void updateAccount(selectedUser.id, {
                        accountStatus: "active",
                      })
                    }
                  >
                    <Check size={14} /> Aprovar acesso
                  </button>
                  <button
                    className="button-danger"
                    onClick={() =>
                      setConfirmAction({
                        userId: selectedUser.id,
                        displayName: selectedUser.displayName,
                        kind: "reject",
                      })
                    }
                  >
                    <Ban size={14} /> Recusar pedido
                  </button>
                </>
              ) : (
                <button
                  className={
                    selectedUser.isActive ? "button-danger" : "button-primary"
                  }
                  disabled={selectedUser.id === portalUser.id}
                  onClick={() => {
                    if (selectedUser.isActive) {
                      setConfirmAction({
                        userId: selectedUser.id,
                        displayName: selectedUser.displayName,
                        kind: "suspend",
                      });
                    } else {
                      void updateAccount(selectedUser.id, {
                        accountStatus: "active",
                      });
                    }
                  }}
                >
                  {selectedUser.isActive ? (
                    <>
                      <Ban size={14} /> Suspender acesso
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Reativar acesso
                    </>
                  )}
                </button>
              )}
              <button
                className="button-secondary"
                onClick={() => {
                  setNoticeTargetId(selectedUser.id);
                  setSelectedUserId(null);
                }}
              >
                <Megaphone size={14} /> Enviar aviso
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-5">
              Último acesso:{" "}
              {selectedUser.lastLoginAt
                ? new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(selectedUser.lastLoginAt))
                : "ainda não acessou"}
              . Contas suspensas têm as sessões encerradas imediatamente.
            </p>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmAction !== null}
        title={
          confirmAction?.kind === "reject"
            ? "Recusar este pedido de acesso?"
            : "Suspender o acesso deste usuário?"
        }
        description={
          confirmAction
            ? confirmAction.kind === "reject"
              ? `${confirmAction.displayName} não poderá entrar no portal. Você pode revisar o pedido novamente depois, se mudar de ideia.`
              : `${confirmAction.displayName} perderá o acesso imediatamente e todas as sessões ativas dessa conta serão encerradas.`
            : ""
        }
        confirmLabel={
          confirmAction?.kind === "reject" ? "Recusar pedido" : "Suspender"
        }
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction)
            void updateAccount(confirmAction.userId, {
              accountStatus: "suspended",
            });
          setConfirmAction(null);
        }}
      />
    </AppShell>
  );
}

/* ══════════════════════════════════════════════════════════
   APP ROOT
══════════════════════════════════════════════════════════ */
function AppRouter({
  store,
  setStore,
  notify,
  user,
  onAuthenticated,
}: {
  store: Store;
  setStore: (s: Store) => void;
  notify: (m: string, k?: ToastKind) => void;
  user: PortalUser | null;
  onAuthenticated: (user: PortalUser) => void;
}) {
  if (!user) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/acesso">
          <Access onAuthenticated={onAuthenticated} />
        </Route>
        <Route component={Landing} />
      </Switch>
    );
  }
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/acesso">
        <Access onAuthenticated={onAuthenticated} />
      </Route>
      <Route path="/painel">
        <Dashboard store={store} setStore={setStore} notify={notify} />
      </Route>
      <Route path="/colaborador/:id">
        <CollaboratorWorkspace
          store={store}
          setStore={setStore}
          notify={notify}
        />
      </Route>
      <Route path="/historico">
        <History store={store} />
      </Route>
      <Route path="/treinamento">
        <Training store={store} setStore={setStore} notify={notify} />
      </Route>
      <Route path="/chat">
        <Chat store={store} notify={notify} />
      </Route>
      <Route path="/configuracoes">
        <Settings store={store} setStore={setStore} notify={notify} />
      </Route>
      <Route path="/admin">
        <Admin store={store} notify={notify} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const [store, setStoreState] = useState<Store>(() => readStore());
  const [user, setUser] = useState<PortalUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [portalReady, setPortalReady] = useState(!PORTAL_API_URL);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const prevApptCountRef = useRef<number>(
    store.collaborators.reduce((s, p) => s + p.appointments.length, 0),
  );
  const portalRevisionRef = useRef(0);
  const skipNextSyncRef = useRef(false);
  const seenNotificationIdsRef = useRef(new Set<string>());

  const setStore = useCallback(
    (next: Store) => {
      setStoreState(next);
      if (user)
        localStorage.setItem(
          `${PORTAL_STORAGE_KEY}:${user.workspaceOwnerId}`,
          JSON.stringify(next),
        );
    },
    [user],
  );

  const notify = useCallback(
    (message: string, kind: ToastKind = "success") => {
      const id = Date.now();
      setToasts((prev) => [...prev.slice(-2), { id, message, kind }]);
      if (store.soundEnabled) {
        playNotificationSound(kind === "notify" ? "alert" : "success");
      }
    },
    [store.soundEnabled],
  );

  const applyRemoteState = useCallback(
    (envelope: PortalEnvelope, activeUser: PortalUser) => {
      portalRevisionRef.current = envelope.revision;
      const next = envelope.state ? storeFromRemote(envelope.state) : null;
      const personal = next ?? personalStore(activeUser);
      skipNextSyncRef.current = true;
      localStorage.setItem(
        `${PORTAL_STORAGE_KEY}:${activeUser.workspaceOwnerId}`,
        JSON.stringify(personal),
      );
      setStoreState(personal);
    },
    [],
  );

  const loadRemoteState = useCallback(async () => {
    if (!PORTAL_API_URL || !user) return;
    try {
      const response = await fetch(`${PORTAL_API_URL}/odonto-portal/state`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) throw new Error("portal state unavailable");
      applyRemoteState((await response.json()) as PortalEnvelope, user);
      setLastSyncedAt(new Date());
      setSyncError(false);
    } catch (error) {
      setSyncError(true);
      throw error;
    }
  }, [applyRemoteState, user]);

  const onAuthenticated = useCallback((nextUser: PortalUser) => {
    portalRevisionRef.current = 0;
    setUser(nextUser);
    const saved = localStorage.getItem(
      `${PORTAL_STORAGE_KEY}:${nextUser.workspaceOwnerId}`,
    );
    setStoreState(
      saved
        ? normalizeStore(JSON.parse(saved) as Partial<Store>)
        : personalStore(nextUser),
    );
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!user) return;
    const response = await fetch(
      `${PORTAL_API_URL}/odonto-portal/notifications`,
      { credentials: "include", cache: "no-store" },
    );
    if (!response.ok) return;
    const result = (await response.json()) as {
      notifications: PortalNotification[];
    };
    setNotifications(result.notifications);
    for (const notification of result.notifications
      .filter((item) => !item.readAt)
      .reverse()) {
      if (!seenNotificationIdsRef.current.has(notification.id))
        notify(`${notification.title}: ${notification.body}`, "notify");
      seenNotificationIdsRef.current.add(notification.id);
    }
  }, [notify, user]);

  const markNotificationRead = useCallback(async (id: string) => {
    await fetch(`${PORTAL_API_URL}/odonto-portal/notifications/${id}/read`, {
      method: "PATCH",
      credentials: "include",
    });
    setNotifications((items) =>
      items.map((item) =>
        item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
      ),
    );
  }, []);

  useEffect(() => {
    void fetch(`${PORTAL_API_URL}/odonto-portal/auth/me`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) =>
        response.ok
          ? ((await response.json()) as { user: PortalUser | null })
          : { user: null },
      )
      .then(({ user: current }) => {
        if (current) onAuthenticated(current);
      })
      .catch(() => undefined)
      .finally(() => setAuthReady(true));
  }, [onAuthenticated]);

  useEffect(() => {
    if (!PORTAL_API_URL || !user) return;
    let active = true;
    void loadRemoteState()
      .catch(() => undefined)
      .finally(() => {
        if (active) setPortalReady(true);
      });
    return () => {
      active = false;
    };
  }, [loadRemoteState, user]);

  useEffect(() => {
    if (!PORTAL_API_URL || !portalReady || !user) return;
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      setSyncing(true);
      void fetch(`${PORTAL_API_URL}/odonto-portal/state`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: store,
          revision: portalRevisionRef.current,
        }),
      })
        .then(async (response) => {
          if (response.status === 409) {
            await loadRemoteState();
            notify(
              "A rotina foi atualizada por outra pessoa. Exibindo a versão mais recente.",
              "notify",
            );
            return;
          }
          if (!response.ok) throw new Error("portal save unavailable");
          const result = (await response.json()) as PortalEnvelope;
          portalRevisionRef.current = result.revision;
          setLastSyncedAt(new Date());
          setSyncError(false);
        })
        .catch(() => setSyncError(true))
        .finally(() => setSyncing(false));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [loadRemoteState, notify, portalReady, store, user]);

  useEffect(() => {
    if (!PORTAL_API_URL || !portalReady || !user || !store.preferences.autoRefresh) return;
    const timer = window.setInterval(() => {
      void loadRemoteState().catch(() => undefined);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [loadRemoteState, portalReady, store.preferences.autoRefresh, user]);

  useEffect(() => {
    if (!user) return;
    const heartbeat = () => {
      void fetch(`${PORTAL_API_URL}/odonto-portal/auth/heartbeat`, {
        method: "POST",
        credentials: "include",
      });
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 45_000);
    return () => window.clearInterval(timer);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void refreshNotifications();
    const timer = window.setInterval(() => {
      void refreshNotifications();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [refreshNotifications, user]);

  // Real-time: detect new appointments added by any tab (storage event)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (
        !user ||
        e.key !== `${PORTAL_STORAGE_KEY}:${user.workspaceOwnerId}` ||
        !e.newValue
      )
        return;
      try {
        const next = JSON.parse(e.newValue) as Store;
        const newCount = next.collaborators.reduce(
          (s, p) => s + p.appointments.length,
          0,
        );
        if (newCount > prevApptCountRef.current) {
          setStoreState(next);
          const diff = newCount - prevApptCountRef.current;
          notify(
            `${diff} novo${diff > 1 ? "s" : ""} agendamento${diff > 1 ? "s" : ""} adicionado${diff > 1 ? "s" : ""}!`,
            "notify",
          );
        } else {
          setStoreState(next);
        }
        prevApptCountRef.current = newCount;
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [notify, user]);

  // Track appointment count for sound when changed locally
  useEffect(() => {
    const count = store.collaborators.reduce(
      (s, p) => s + p.appointments.length,
      0,
    );
    prevApptCountRef.current = count;
  }, [store.collaborators]);

  // Midnight rollover check
  useEffect(() => {
    const t = setInterval(() => {
      if (localDateKey() !== today) window.location.reload();
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    document.title = "Odonto Excellence · Gestão Clínica";
  }, []);

  if (!authReady)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
        aria-live="polite"
        aria-busy="true"
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "3px solid rgba(0,0,0,0.12)",
            borderTopColor: "currentColor",
            animation: "odonto-spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes odonto-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  return (
    <TooltipProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <PortalAuthContext.Provider value={user}>
          <NotificationContext.Provider
            value={{
              notifications,
              refresh: refreshNotifications,
              markRead: markNotificationRead,
            }}
          >
            <SyncStatusContext.Provider
              value={{ lastSyncedAt, syncing, syncError }}
            >
              <AppRouter
                store={store}
                setStore={setStore}
                notify={notify}
                user={user}
                onAuthenticated={onAuthenticated}
              />
              {user?.mustChangePassword && (
                <PasswordChangeModal
                  required
                  onChanged={onAuthenticated}
                  notify={notify}
                />
              )}
            </SyncStatusContext.Provider>
          </NotificationContext.Provider>
        </PortalAuthContext.Provider>
      </WouterRouter>
      <Toaster />
      {/* Toast stack */}
      <div className="fixed right-5 bottom-5 z-[60] flex flex-col gap-2 items-end">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            msg={t}
            onClose={() =>
              setToasts((prev) => prev.filter((x) => x.id !== t.id))
            }
          />
        ))}
      </div>
    </TooltipProvider>
  );
}
