const API_URL = (
  import.meta.env.VITE_ODONTO_API_URL ??
  "https://odonto-excellence-api.onrender.com/api"
).replace(/\/$/, "");

const TRAINING_TARGET = 218;
const STYLE_ID = "oe-training-professional-style";
const OVERVIEW_ID = "oe-training-professional-overview";

type TrainingState = {
  training?: Array<Record<string, unknown>>;
};

function isPortalStateSave(url: URL, method: string) {
  try {
    return (
      url.origin === new URL(API_URL).origin &&
      url.pathname.endsWith("/odonto-portal/state") &&
      method === "PUT"
    );
  } catch {
    return false;
  }
}

function normalizeTrainingState(state: TrainingState | undefined) {
  if (!Array.isArray(state?.training)) return state;
  const now = new Date().toISOString();
  state.training = state.training.map((item) => ({
    ...item,
    watched: true,
    completedAt:
      typeof item.completedAt === "string" && item.completedAt
        ? item.completedAt
        : now,
  }));
  return state;
}

function normalizeTrainingPayload(body: BodyInit | null | undefined) {
  if (typeof body !== "string") return body;
  try {
    const parsed = JSON.parse(body) as { state?: TrainingState };
    normalizeTrainingState(parsed.state);
    return JSON.stringify(parsed);
  } catch {
    return body;
  }
}

function installAutomaticWatchedPersistence() {
  if ((window as unknown as { __oeTrainingAutoWatched?: boolean }).__oeTrainingAutoWatched)
    return;
  (window as unknown as { __oeTrainingAutoWatched?: boolean }).__oeTrainingAutoWatched = true;

  const previousFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(rawUrl, window.location.href);
    const method = (
      init?.method ||
      (input instanceof Request ? input.method : "GET")
    ).toUpperCase();

    if (!isPortalStateSave(url, method)) return previousFetch(input, init);

    const nextInit: RequestInit = {
      ...init,
      body: normalizeTrainingPayload(init?.body),
    };
    return previousFetch(input, nextInit);
  };
}

function installProfessionalStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    html.oe-training-page button[aria-label^="Marcar pendente:"],
    html.oe-training-page button[aria-label^="Concluir:"] {
      display: none !important;
    }

    html.oe-training-page button[aria-label^="Selecionar "] {
      display: none !important;
    }

    html.oe-training-page .oe-training-record-title {
      text-decoration: none !important;
      color: hsl(var(--foreground)) !important;
      opacity: 1 !important;
    }

    html.oe-training-page .oe-training-record {
      position: relative;
      padding-left: 1.25rem !important;
      padding-right: 1.25rem !important;
      background: transparent;
    }

    html.oe-training-page .oe-training-record:hover {
      background: hsl(var(--muted) / .28) !important;
    }

    .oe-training-record-state {
      flex: 0 0 auto;
      border: 1px solid hsl(var(--border));
      border-radius: 999px;
      padding: .32rem .62rem;
      font-size: 9px;
      line-height: 1;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: hsl(var(--muted-foreground));
      background: hsl(var(--background));
    }

    #${OVERVIEW_ID} {
      margin-top: 2rem;
      border: 1px solid hsl(var(--border));
      border-radius: 20px;
      overflow: hidden;
      background: hsl(var(--card));
      box-shadow: 0 16px 44px hsl(var(--foreground) / .04);
    }

    #${OVERVIEW_ID} .oe-training-overview-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.25rem 1.35rem 1rem;
      border-bottom: 1px solid hsl(var(--border));
    }

    #${OVERVIEW_ID} .oe-training-overview-kicker {
      font-size: 9px;
      font-weight: 900;
      letter-spacing: .14em;
      text-transform: uppercase;
      color: hsl(var(--muted-foreground));
    }

    #${OVERVIEW_ID} .oe-training-overview-title {
      margin-top: .35rem;
      font-size: 18px;
      font-weight: 900;
      letter-spacing: -.025em;
      color: hsl(var(--foreground));
    }

    #${OVERVIEW_ID} .oe-training-overview-copy {
      margin-top: .4rem;
      max-width: 680px;
      font-size: 11px;
      line-height: 1.55;
      color: hsl(var(--muted-foreground));
    }

    #${OVERVIEW_ID} .oe-training-overview-badge {
      flex: 0 0 auto;
      border: 1px solid hsl(var(--border));
      border-radius: 999px;
      padding: .5rem .72rem;
      font-size: 10px;
      font-weight: 850;
      color: hsl(var(--foreground));
      background: hsl(var(--secondary) / .45);
    }

    #${OVERVIEW_ID} .oe-training-overview-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    #${OVERVIEW_ID} .oe-training-overview-metric {
      padding: 1.15rem 1.35rem 1.25rem;
      border-right: 1px solid hsl(var(--border));
    }

    #${OVERVIEW_ID} .oe-training-overview-metric:last-child {
      border-right: 0;
    }

    #${OVERVIEW_ID} .oe-training-overview-label {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: hsl(var(--muted-foreground));
    }

    #${OVERVIEW_ID} .oe-training-overview-value {
      margin-top: .42rem;
      font-size: 30px;
      line-height: 1;
      font-weight: 950;
      letter-spacing: -.05em;
      color: hsl(var(--foreground));
    }

    #${OVERVIEW_ID} .oe-training-overview-detail {
      margin-top: .4rem;
      font-size: 10px;
      color: hsl(var(--muted-foreground));
    }

    #${OVERVIEW_ID} .oe-training-progress-line {
      height: 4px;
      background: hsl(var(--muted));
    }

    #${OVERVIEW_ID} .oe-training-progress-value {
      height: 100%;
      width: 0;
      background: hsl(var(--primary));
      transition: width .25s ease;
    }

    html.oe-training-page .oe-training-legacy-stats {
      display: none !important;
    }

    @media (max-width: 820px) {
      #${OVERVIEW_ID} .oe-training-overview-head {
        flex-direction: column;
      }

      #${OVERVIEW_ID} .oe-training-overview-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      #${OVERVIEW_ID} .oe-training-overview-metric:nth-child(2) {
        border-right: 0;
      }

      #${OVERVIEW_ID} .oe-training-overview-metric:nth-child(-n+2) {
        border-bottom: 1px solid hsl(var(--border));
      }
    }
  `;
  document.head.append(style);
}

function exactText(root: ParentNode, value: string) {
  return Array.from(root.querySelectorAll<HTMLElement>("*")).find(
    (node) => node.children.length === 0 && node.textContent?.trim() === value,
  );
}

function trainingRoot() {
  const title = Array.from(document.querySelectorAll<HTMLElement>("h1")).find(
    (node) => node.textContent?.trim() === "Treinar para cuidar.",
  );
  return title?.closest<HTMLElement>(".content-wrap") ?? null;
}

function legacyStatsRoot(root: HTMLElement) {
  const totalLabel = exactText(root, "Aulas totais");
  if (!totalLabel) return null;

  let node: HTMLElement | null = totalLabel.parentElement;
  let last: HTMLElement | null = node;
  while (node && node !== root) {
    const text = node.textContent ?? "";
    if (
      text.includes("Aulas totais") &&
      text.includes("Assistidas") &&
      text.includes("Restantes") &&
      text.includes("Tempo registrado")
    ) {
      return node;
    }
    last = node;
    node = node.parentElement;
  }
  return last;
}

function totalCard(root: HTMLElement) {
  const label = exactText(root, "Aulas totais");
  if (!label) return null;
  let node: HTMLElement | null = label.parentElement;
  while (node && node !== root) {
    const text = node.textContent ?? "";
    if (text.includes("Aulas totais") && !text.includes("Assistidas")) return node;
    node = node.parentElement;
  }
  return null;
}

function launchedCount(root: HTMLElement) {
  const card = totalCard(root);
  if (!card) return 0;
  const raw = (card.textContent ?? "").replace("Aulas totais", "");
  const match = raw.match(/\d+/);
  return match ? Math.max(0, Number(match[0])) : 0;
}

function ensureOverview(root: HTMLElement, oldStats: HTMLElement, launched: number) {
  const watched = launched;
  const remaining = Math.max(0, TRAINING_TARGET - watched);
  const percentage = Math.min(100, Math.round((watched / TRAINING_TARGET) * 100));
  let overview = root.querySelector<HTMLElement>(`#${OVERVIEW_ID}`);

  if (!overview) {
    overview = document.createElement("section");
    overview.id = OVERVIEW_ID;
    overview.innerHTML = `
      <div class="oe-training-overview-head">
        <div>
          <div class="oe-training-overview-kicker">Programa de formação</div>
          <div class="oe-training-overview-title">Progresso consolidado</div>
          <div class="oe-training-overview-copy">Cada vídeo lançado entra automaticamente no histórico como concluído. Não há marcação manual, alteração de status ou etapa adicional.</div>
        </div>
        <div class="oe-training-overview-badge">Meta padrão · ${TRAINING_TARGET} vídeos</div>
      </div>
      <div class="oe-training-overview-grid">
        <div class="oe-training-overview-metric">
          <div class="oe-training-overview-label">Meta total</div>
          <div class="oe-training-overview-value" data-training-target>${TRAINING_TARGET}</div>
          <div class="oe-training-overview-detail">vídeos no programa</div>
        </div>
        <div class="oe-training-overview-metric">
          <div class="oe-training-overview-label">Concluídos</div>
          <div class="oe-training-overview-value" data-training-watched>0</div>
          <div class="oe-training-overview-detail">registros já lançados</div>
        </div>
        <div class="oe-training-overview-metric">
          <div class="oe-training-overview-label">Restantes</div>
          <div class="oe-training-overview-value" data-training-remaining>${TRAINING_TARGET}</div>
          <div class="oe-training-overview-detail">até a meta completa</div>
        </div>
        <div class="oe-training-overview-metric">
          <div class="oe-training-overview-label">Progresso</div>
          <div class="oe-training-overview-value" data-training-percentage>0%</div>
          <div class="oe-training-overview-detail">do programa concluído</div>
        </div>
      </div>
      <div class="oe-training-progress-line"><div class="oe-training-progress-value" data-training-progress-bar></div></div>
    `;
    oldStats.insertAdjacentElement("beforebegin", overview);
  }

  const set = (selector: string, value: string) => {
    const node = overview?.querySelector<HTMLElement>(selector);
    if (node && node.textContent !== value) node.textContent = value;
  };
  set("[data-training-target]", String(TRAINING_TARGET));
  set("[data-training-watched]", String(watched));
  set("[data-training-remaining]", String(remaining));
  set("[data-training-percentage]", `${percentage}%`);
  const bar = overview.querySelector<HTMLElement>("[data-training-progress-bar]");
  if (bar && bar.style.width !== `${percentage}%`) bar.style.width = `${percentage}%`;
}

function refineRecords(root: HTMLElement) {
  root
    .querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="Marcar pendente:"], button[aria-label^="Concluir:"]',
    )
    .forEach((button) => {
      const row = button.parentElement;
      if (!row) return;
      row.classList.add("oe-training-record");
      button.disabled = true;
      button.style.pointerEvents = "none";
      button.setAttribute("aria-label", "Registro concluído automaticamente");

      const title = row.querySelector<HTMLElement>(".text-sm.font-bold");
      if (title) title.classList.add("oe-training-record-title");

      row.querySelectorAll<HTMLButtonElement>('button[aria-label^="Selecionar "]').forEach((play) => {
        play.remove();
      });

      if (!row.querySelector(".oe-training-record-state")) {
        const state = document.createElement("span");
        state.className = "oe-training-record-state";
        state.textContent = "Registrado";
        row.append(state);
      }
    });

  root.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    if (button.textContent?.replace(/\s+/g, " ").trim() === "Marcar próxima aula") {
      button.remove();
    }
  });
}

let scheduled = false;
function refreshProfessionalTrainingUi() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    const root = trainingRoot();
    document.documentElement.classList.toggle("oe-training-page", Boolean(root));
    if (!root) return;

    refineRecords(root);
    const oldStats = legacyStatsRoot(root);
    if (!oldStats) return;
    const launched = launchedCount(root);
    oldStats.classList.add("oe-training-legacy-stats");
    ensureOverview(root, oldStats, launched);
  });
}

function installTrainingUiGuard() {
  installProfessionalStyle();
  refreshProfessionalTrainingUi();

  new MutationObserver(() => refreshProfessionalTrainingUi()).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target.closest("button") : null;
      const label = target?.getAttribute("aria-label") ?? "";
      if (
        label === "Registro concluído automaticamente" ||
        label.startsWith("Marcar pendente:") ||
        label.startsWith("Concluir:")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
}

export function installTrainingProgressEnhancements() {
  installAutomaticWatchedPersistence();
  installTrainingUiGuard();
}
