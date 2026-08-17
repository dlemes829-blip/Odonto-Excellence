const API_URL = (
  import.meta.env.VITE_ODONTO_API_URL ??
  "https://odonto-excellence-api.onrender.com/api"
).replace(/\/$/, "");

const TRAINING_TARGET = 218;
const STYLE_ID = "oe-training-professional-style-v2";
const OVERVIEW_ID = "oe-training-professional-overview";
const SEARCH_ID = "oe-training-search";
const AGENT_ID = "oe-training-agent";

type TrainingState = {
  training?: Array<Record<string, unknown>>;
};

type AgentHistoryItem = {
  role: "user" | "assistant";
  content: string;
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

function normalizeTrainingPayload(body: BodyInit | null | undefined) {
  if (typeof body !== "string") return body;
  try {
    const parsed = JSON.parse(body) as { state?: TrainingState };
    if (!Array.isArray(parsed.state?.training)) return body;
    const now = new Date().toISOString();
    parsed.state.training = parsed.state.training.map((item) => ({
      ...item,
      watched: true,
      completedAt:
        typeof item.completedAt === "string" && item.completedAt
          ? item.completedAt
          : now,
    }));
    return JSON.stringify(parsed);
  } catch {
    return body;
  }
}

function installAutomaticWatchedPersistence() {
  const flag = window as unknown as { __oeTrainingAutoWatched?: boolean };
  if (flag.__oeTrainingAutoWatched) return;
  flag.__oeTrainingAutoWatched = true;

  const previousFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(rawUrl, window.location.href);
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (!isPortalStateSave(url, method)) return previousFetch(input, init);
    return previousFetch(input, {
      ...init,
      body: normalizeTrainingPayload(init?.body),
    });
  };
}

function installProfessionalStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    html.oe-training-page button[aria-label^="Marcar pendente:"],
    html.oe-training-page button[aria-label^="Concluir:"],
    html.oe-training-page button[aria-label^="Selecionar "] { display:none!important; }
    html.oe-training-page .oe-training-record-title { text-decoration:none!important; color:hsl(var(--foreground))!important; opacity:1!important; }
    html.oe-training-page .oe-training-record { position:relative; padding-left:1.25rem!important; padding-right:1.25rem!important; background:transparent; }
    html.oe-training-page .oe-training-record:hover { background:hsl(var(--muted)/.28)!important; }
    html.oe-training-page .oe-training-legacy-stats { display:none!important; }
    .oe-training-record-state { flex:0 0 auto; border:1px solid hsl(var(--border)); border-radius:999px; padding:.32rem .62rem; font-size:9px; line-height:1; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:hsl(var(--muted-foreground)); background:hsl(var(--background)); }
    #${OVERVIEW_ID} { margin-top:2rem; border:1px solid hsl(var(--border)); border-radius:20px; overflow:hidden; background:hsl(var(--card)); box-shadow:0 16px 44px hsl(var(--foreground)/.04); }
    #${OVERVIEW_ID} .oe-training-overview-head { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; padding:1.25rem 1.35rem 1rem; border-bottom:1px solid hsl(var(--border)); }
    #${OVERVIEW_ID} .kicker { font-size:9px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:hsl(var(--muted-foreground)); }
    #${OVERVIEW_ID} .title { margin-top:.35rem; font-size:18px; font-weight:900; letter-spacing:-.025em; }
    #${OVERVIEW_ID} .copy { margin-top:.4rem; max-width:680px; font-size:11px; line-height:1.55; color:hsl(var(--muted-foreground)); }
    #${OVERVIEW_ID} .badge { flex:0 0 auto; border:1px solid hsl(var(--border)); border-radius:999px; padding:.5rem .72rem; font-size:10px; font-weight:850; background:hsl(var(--secondary)/.45); }
    #${OVERVIEW_ID} .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); }
    #${OVERVIEW_ID} .metric { padding:1.15rem 1.35rem 1.25rem; border-right:1px solid hsl(var(--border)); }
    #${OVERVIEW_ID} .metric:last-child { border-right:0; }
    #${OVERVIEW_ID} .label { font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:hsl(var(--muted-foreground)); }
    #${OVERVIEW_ID} .value { margin-top:.42rem; font-size:30px; line-height:1; font-weight:950; letter-spacing:-.05em; }
    #${OVERVIEW_ID} .detail { margin-top:.4rem; font-size:10px; color:hsl(var(--muted-foreground)); }
    #${OVERVIEW_ID} .progress { height:4px; background:hsl(var(--muted)); }
    #${OVERVIEW_ID} .progress>div { height:100%; background:hsl(var(--primary)); transition:width .25s ease; }
    #${SEARCH_ID} { display:flex; align-items:center; gap:.7rem; margin-top:1rem; padding:.7rem .85rem; border:1px solid hsl(var(--border)); border-radius:12px; background:hsl(var(--background)); }
    #${SEARCH_ID} svg { width:15px; height:15px; color:hsl(var(--muted-foreground)); flex:0 0 auto; }
    #${SEARCH_ID} input { min-width:0; flex:1; border:0; outline:0; background:transparent; font-size:12px; color:hsl(var(--foreground)); }
    #${SEARCH_ID} small { font-size:9px; color:hsl(var(--muted-foreground)); white-space:nowrap; }
    .oe-agent-button { display:inline-flex; align-items:center; gap:.5rem; border:1px solid rgba(197,157,80,.42); border-radius:12px; padding:.72rem 1rem; font-size:11px; font-weight:900; color:#6f5422; background:linear-gradient(135deg,#fffaf0,#f4e5bc); box-shadow:0 8px 24px rgba(150,112,38,.12); transition:.18s ease; }
    .oe-agent-button:hover { transform:translateY(-1px); box-shadow:0 12px 30px rgba(150,112,38,.18); }
    #${AGENT_ID} { position:fixed; inset:0; z-index:90; display:grid; place-items:center; padding:18px; background:rgba(26,20,10,.34); backdrop-filter:blur(5px); }
    #${AGENT_ID}[hidden] { display:none!important; }
    #${AGENT_ID} .shell { width:min(760px,100%); height:min(680px,88dvh); display:flex; flex-direction:column; overflow:hidden; border:1px solid rgba(197,157,80,.38); border-radius:24px; background:hsl(var(--background)); box-shadow:0 30px 90px rgba(47,34,8,.28); }
    #${AGENT_ID} .head { display:flex; align-items:center; gap:12px; padding:18px 20px; border-bottom:1px solid hsl(var(--border)); background:linear-gradient(135deg,#fffaf0,#f4e7c7); color:#4e3a16; }
    #${AGENT_ID} .brand { width:38px; height:38px; display:grid; place-items:center; border-radius:12px; background:#b98a31; color:white; font-weight:950; }
    #${AGENT_ID} .head b { display:block; font-size:14px; }
    #${AGENT_ID} .head small { display:block; margin-top:2px; font-size:10px; opacity:.72; }
    #${AGENT_ID} .close { margin-left:auto; border:0; background:transparent; font-size:24px; cursor:pointer; color:#6a5123; }
    #${AGENT_ID} .messages { flex:1; overflow:auto; padding:18px; background:linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/.18)); }
    #${AGENT_ID} .msg { max-width:82%; margin:0 0 12px; padding:11px 13px; border-radius:16px; font-size:12px; line-height:1.55; white-space:pre-wrap; }
    #${AGENT_ID} .assistant { border:1px solid rgba(197,157,80,.26); background:#fff9ea; color:#49381b; border-bottom-left-radius:5px; }
    #${AGENT_ID} .user { margin-left:auto; background:hsl(var(--primary)); color:white; border-bottom-right-radius:5px; }
    #${AGENT_ID} .compose { display:flex; gap:9px; padding:14px; border-top:1px solid hsl(var(--border)); }
    #${AGENT_ID} textarea { flex:1; min-height:44px; max-height:120px; resize:none; border:1px solid hsl(var(--border)); border-radius:12px; padding:11px 12px; outline:none; background:hsl(var(--background)); color:hsl(var(--foreground)); font-size:12px; }
    #${AGENT_ID} .send { flex:0 0 auto; align-self:flex-end; border:0; border-radius:12px; padding:12px 16px; font-size:11px; font-weight:900; color:#fff; background:#b98a31; cursor:pointer; }
    #${AGENT_ID} .send:disabled { opacity:.5; cursor:wait; }
    @media(max-width:820px){ #${OVERVIEW_ID} .oe-training-overview-head{flex-direction:column} #${OVERVIEW_ID} .grid{grid-template-columns:repeat(2,minmax(0,1fr))} #${AGENT_ID}{padding:0} #${AGENT_ID} .shell{height:100dvh;width:100%;border-radius:0} }
  `;
  document.head.append(style);
}

function exactText(root: ParentNode, value: string) {
  return Array.from(root.querySelectorAll<HTMLElement>("*")).find(
    (node) => node.children.length === 0 && node.textContent?.trim() === value,
  );
}

function trainingRoot() {
  const title = Array.from(document.querySelectorAll<HTMLElement>("h1")).find((node) => {
    const text = node.textContent?.trim();
    return text === "Treinar para cuidar." || text === "Treinamento Gerente Odonto.";
  });
  return title?.closest<HTMLElement>(".content-wrap") ?? null;
}

function legacyStatsRoot(root: HTMLElement) {
  const totalLabel = exactText(root, "Aulas totais");
  if (!totalLabel) return null;
  let node: HTMLElement | null = totalLabel.parentElement;
  while (node && node !== root) {
    const text = node.textContent ?? "";
    if (text.includes("Aulas totais") && text.includes("Assistidas") && text.includes("Restantes")) return node;
    node = node.parentElement;
  }
  return null;
}

function refineRecords(root: HTMLElement) {
  root.querySelectorAll<HTMLButtonElement>('button[aria-label^="Marcar pendente:"],button[aria-label^="Concluir:"]').forEach((button) => {
    const row = button.parentElement;
    if (!row) return;
    row.classList.add("oe-training-record");
    button.disabled = true;
    button.style.pointerEvents = "none";
    const title = row.querySelector<HTMLElement>(".text-sm.font-bold");
    if (title) title.classList.add("oe-training-record-title");
    row.querySelectorAll<HTMLButtonElement>('button[aria-label^="Selecionar "]').forEach((play) => play.remove());
    if (!row.querySelector(".oe-training-record-state")) {
      const state = document.createElement("span");
      state.className = "oe-training-record-state";
      state.textContent = "Registrado";
      row.append(state);
    }
  });
  root.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    if (button.textContent?.replace(/\s+/g," ").trim() === "Marcar próxima aula") button.remove();
  });
}

function ensureTitleAndActions(root: HTMLElement) {
  const h1 = root.querySelector<HTMLElement>("h1");
  if (h1 && h1.textContent?.trim() !== "Treinamento Gerente Odonto.") h1.textContent = "Treinamento Gerente Odonto.";

  const back = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
    button.textContent?.includes("Menu principal"),
  );
  const actions = back?.parentElement;
  if (actions && !actions.querySelector(".oe-agent-button")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "oe-agent-button";
    button.innerHTML = `<span aria-hidden="true">✦</span> Kyron Agent`;
    button.addEventListener("click", () => openAgent());
    actions.insertBefore(button, back ?? null);
  }
}

function ensureSearch(root: HTMLElement) {
  const trailTitle = exactText(root, "Aulas para o dia a dia");
  const header = trailTitle?.parentElement;
  if (!header || header.querySelector(`#${SEARCH_ID}`)) return;
  const wrap = document.createElement("label");
  wrap.id = SEARCH_ID;
  wrap.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg><input type="search" placeholder="Pesquisar vídeos, temas ou áreas" autocomplete="off"/><small></small>`;
  const input = wrap.querySelector<HTMLInputElement>("input")!;
  const count = wrap.querySelector<HTMLElement>("small")!;
  input.addEventListener("input", () => {
    const query = input.value.trim().toLocaleLowerCase("pt-BR");
    let visible = 0;
    root.querySelectorAll<HTMLElement>(".oe-training-record").forEach((row) => {
      const matches = !query || (row.textContent ?? "").toLocaleLowerCase("pt-BR").includes(query);
      row.style.display = matches ? "" : "none";
      if (matches) visible += 1;
    });
    count.textContent = query ? `${visible} encontrado${visible === 1 ? "" : "s"}` : "";
  });
  header.append(wrap);
}

function launchedCount(root: HTMLElement) {
  return root.querySelectorAll(".oe-training-record").length;
}

function ensureOverview(root: HTMLElement, oldStats: HTMLElement) {
  const launched = launchedCount(root);
  const remaining = Math.max(0, TRAINING_TARGET - launched);
  const pct = Math.min(100, Math.round((launched / TRAINING_TARGET) * 100));
  let overview = root.querySelector<HTMLElement>(`#${OVERVIEW_ID}`);
  if (!overview) {
    overview = document.createElement("section");
    overview.id = OVERVIEW_ID;
    overview.innerHTML = `<div class="oe-training-overview-head"><div><div class="kicker">Programa de formação</div><div class="title">Progresso consolidado</div><div class="copy">Cada vídeo lançado entra automaticamente como concluído. A meta do programa é padronizada para todos os usuários.</div></div><div class="badge">Meta padrão · ${TRAINING_TARGET} vídeos</div></div><div class="grid"><div class="metric"><div class="label">Meta total</div><div class="value" data-target></div><div class="detail">vídeos no programa</div></div><div class="metric"><div class="label">Concluídos</div><div class="value" data-done></div><div class="detail">vídeos registrados</div></div><div class="metric"><div class="label">Restantes</div><div class="value" data-left></div><div class="detail">até a conclusão</div></div><div class="metric"><div class="label">Progresso</div><div class="value" data-pct></div><div class="detail">do programa concluído</div></div></div><div class="progress"><div data-bar></div></div>`;
    oldStats.insertAdjacentElement("beforebegin", overview);
  }
  const set = (s: string, v: string) => { const n = overview?.querySelector<HTMLElement>(s); if (n) n.textContent = v; };
  set("[data-target]", String(TRAINING_TARGET));
  set("[data-done]", String(launched));
  set("[data-left]", String(remaining));
  set("[data-pct]", `${pct}%`);
  const bar = overview.querySelector<HTMLElement>("[data-bar]");
  if (bar) bar.style.width = `${pct}%`;
  oldStats.classList.add("oe-training-legacy-stats");
}

let agentHistory: AgentHistoryItem[] = [];

function ensureAgentShell() {
  let agent = document.getElementById(AGENT_ID) as HTMLElement | null;
  if (agent) return agent;
  agent = document.createElement("div");
  agent.id = AGENT_ID;
  agent.hidden = true;
  agent.innerHTML = `<div class="shell" role="dialog" aria-modal="true" aria-label="Kyron Agent para treinamentos"><div class="head"><div class="brand">K</div><div><b>Kyron Agent</b><small>Assistente de aprendizado · Treinamento Gerente Odonto</small></div><button class="close" type="button" aria-label="Fechar">×</button></div><div class="messages"><div class="msg assistant">Posso ajudar a revisar conceitos, localizar um vídeo e esclarecer dúvidas com base nos seus treinamentos e observações registradas.</div></div><form class="compose"><textarea maxlength="2000" placeholder="Pergunte sobre um vídeo, conceito ou anotação..."></textarea><button class="send" type="submit">Enviar</button></form></div>`;
  document.body.append(agent);
  agent.querySelector<HTMLButtonElement>(".close")?.addEventListener("click", closeAgent);
  agent.addEventListener("click", (event) => { if (event.target === agent) closeAgent(); });
  agent.querySelector<HTMLFormElement>("form")?.addEventListener("submit", (event) => { event.preventDefault(); void sendAgentMessage(agent!); });
  agent.querySelector<HTMLTextAreaElement>("textarea")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); agent?.querySelector<HTMLFormElement>("form")?.requestSubmit(); }
  });
  return agent;
}

function openAgent() {
  const agent = ensureAgentShell();
  agent.hidden = false;
  document.documentElement.style.overflow = "hidden";
  window.setTimeout(() => agent.querySelector<HTMLTextAreaElement>("textarea")?.focus(), 0);
}

function closeAgent() {
  const agent = document.getElementById(AGENT_ID) as HTMLElement | null;
  if (agent) agent.hidden = true;
  document.documentElement.style.overflow = "";
}

function appendAgentMessage(agent: HTMLElement, role: "user" | "assistant", content: string) {
  const messages = agent.querySelector<HTMLElement>(".messages");
  if (!messages) return;
  const node = document.createElement("div");
  node.className = `msg ${role}`;
  node.textContent = content;
  messages.append(node);
  messages.scrollTop = messages.scrollHeight;
}

async function sendAgentMessage(agent: HTMLElement) {
  const textarea = agent.querySelector<HTMLTextAreaElement>("textarea");
  const button = agent.querySelector<HTMLButtonElement>(".send");
  const message = textarea?.value.trim() ?? "";
  if (!message || !textarea || !button) return;
  textarea.value = "";
  appendAgentMessage(agent, "user", message);
  button.disabled = true;
  button.textContent = "Pensando...";
  try {
    const response = await fetch(`${API_URL}/odonto-portal/training-agent`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: agentHistory.slice(-6) }),
    });
    const body = (await response.json().catch(() => ({}))) as { content?: string; error?: string };
    if (!response.ok || !body.content) throw new Error(body.error || "O Kyron Agent está indisponível agora.");
    appendAgentMessage(agent, "assistant", body.content);
    agentHistory = [...agentHistory, { role: "user", content: message }, { role: "assistant", content: body.content }].slice(-8);
  } catch (error) {
    appendAgentMessage(agent, "assistant", error instanceof Error ? error.message : "Não foi possível consultar o Kyron Agent agora.");
  } finally {
    button.disabled = false;
    button.textContent = "Enviar";
  }
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
    ensureTitleAndActions(root);
    refineRecords(root);
    ensureSearch(root);
    const oldStats = legacyStatsRoot(root);
    if (oldStats) ensureOverview(root, oldStats);
  });
}

function installTrainingUiGuard() {
  installProfessionalStyle();
  ensureAgentShell();
  refreshProfessionalTrainingUi();
  new MutationObserver(refreshProfessionalTrainingUi).observe(document.documentElement, { childList:true, subtree:true });
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    const label = target?.getAttribute("aria-label") ?? "";
    if (label.startsWith("Marcar pendente:") || label.startsWith("Concluir:")) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

export function installTrainingProgressEnhancements() {
  installAutomaticWatchedPersistence();
  installTrainingUiGuard();
}
