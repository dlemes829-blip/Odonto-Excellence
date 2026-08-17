const API_URL = (
  import.meta.env.VITE_ODONTO_API_URL ??
  "https://odonto-excellence-api.onrender.com/api"
).replace(/\/$/, "");

type AccountType = "creator" | "supervisor" | "manager" | "member" | "individual";
type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  accountType: AccountType;
};
type TeamUser = {
  id: string;
  username: string;
  displayName: string;
  accountType: string;
  accountStatus: string;
  managerId: string | null;
  isActive: boolean;
  online?: boolean;
  teamMemberLimit?: number;
};
type TeamPayload = { managers: TeamUser[]; members: TeamUser[] };
type AdminPayload = {
  users: Array<TeamUser & { personId: string | null }>;
  relations: Array<{ supervisorId: string; managerId: string }>;
};

const hierarchyStyles = `
.oe-hierarchy-nav { width: 100%; text-align: left; gap: 10px; }
.oe-hierarchy-mobile { margin-left: 4px; }
.oe-hierarchy-overlay {
  position: fixed; inset: 0; z-index: 180; background: hsl(var(--background));
  color: hsl(var(--foreground)); overflow: auto;
}
.oe-hierarchy-shell { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 56px; }
.oe-hierarchy-head { display:flex; justify-content:space-between; align-items:flex-start; gap:18px; margin-bottom:24px; }
.oe-hierarchy-head h1 { margin:4px 0 0; font-size:clamp(26px,4vw,42px); letter-spacing:-.04em; font-weight:900; }
.oe-hierarchy-head p { margin:8px 0 0; color:hsl(var(--muted-foreground)); max-width:720px; font-size:13px; line-height:1.6; }
.oe-hierarchy-kicker { color:hsl(var(--primary)); font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.14em; }
.oe-hierarchy-close { width:42px; height:42px; border:1px solid hsl(var(--border)); border-radius:12px; background:hsl(var(--card)); font-size:25px; }
.oe-hierarchy-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:20px; }
.oe-hierarchy-stat, .oe-hierarchy-card { border:1px solid hsl(var(--border)); background:hsl(var(--card)); border-radius:16px; }
.oe-hierarchy-stat { padding:18px; }
.oe-hierarchy-stat small { color:hsl(var(--muted-foreground)); font-size:10px; text-transform:uppercase; font-weight:800; letter-spacing:.08em; }
.oe-hierarchy-stat strong { display:block; margin-top:8px; font-size:27px; letter-spacing:-.04em; }
.oe-hierarchy-card { padding:18px; margin-top:12px; }
.oe-hierarchy-card-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.oe-hierarchy-card h2, .oe-hierarchy-card h3 { margin:0; font-weight:850; letter-spacing:-.02em; }
.oe-hierarchy-muted { color:hsl(var(--muted-foreground)); font-size:11px; }
.oe-hierarchy-badge { display:inline-flex; align-items:center; border-radius:999px; padding:5px 9px; font-size:9px; font-weight:850; text-transform:uppercase; letter-spacing:.06em; background:hsl(var(--secondary)); }
.oe-hierarchy-badge.online { background:hsl(145 65% 45% / .12); color:hsl(145 58% 35%); }
.oe-hierarchy-list { margin-top:14px; border-top:1px solid hsl(var(--border)); }
.oe-hierarchy-row { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:12px; padding:13px 0; border-bottom:1px solid hsl(var(--border)); }
.oe-hierarchy-row:last-child { border-bottom:0; }
.oe-hierarchy-name { font-size:13px; font-weight:800; }
.oe-hierarchy-actions { display:flex; align-items:center; gap:7px; flex-wrap:wrap; justify-content:flex-end; }
.oe-hierarchy-btn { min-height:36px; padding:0 12px; border-radius:9px; border:1px solid hsl(var(--border)); background:hsl(var(--secondary)); color:hsl(var(--secondary-foreground)); font-size:10px; font-weight:850; }
.oe-hierarchy-btn.primary { background:hsl(var(--primary)); color:hsl(var(--primary-foreground)); border-color:hsl(var(--primary)); }
.oe-hierarchy-btn.danger { color:hsl(var(--destructive)); }
.oe-hierarchy-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.oe-hierarchy-form { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-top:14px; }
.oe-hierarchy-form input, .oe-hierarchy-form select, .oe-hierarchy-select {
  width:100%; min-height:40px; border:1px solid hsl(var(--input)); background:hsl(var(--background)); color:hsl(var(--foreground)); border-radius:10px; padding:0 11px; font-size:11px;
}
.oe-hierarchy-section-title { margin:28px 0 4px; font-size:19px; font-weight:900; letter-spacing:-.025em; }
.oe-hierarchy-empty { padding:28px 12px; text-align:center; color:hsl(var(--muted-foreground)); font-size:12px; }
.oe-hierarchy-error { margin:12px 0; padding:11px 13px; border-radius:10px; background:hsl(var(--destructive) / .08); color:hsl(var(--destructive)); font-size:11px; font-weight:700; }
@media(max-width:800px){
 .oe-hierarchy-shell{width:min(100% - 22px,1180px);padding-top:18px}.oe-hierarchy-stats{grid-template-columns:repeat(2,1fr)}.oe-hierarchy-grid{grid-template-columns:1fr}.oe-hierarchy-form{grid-template-columns:1fr}.oe-hierarchy-row{grid-template-columns:1fr}.oe-hierarchy-actions{justify-content:flex-start}.oe-hierarchy-mobile{display:inline-flex!important}
}
`;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...(init.headers || {}) } : init?.headers,
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "Não foi possível concluir esta operação.");
  return body;
}

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function installStyle() {
  if (document.getElementById("oe-hierarchy-style")) return;
  const style = document.createElement("style");
  style.id = "oe-hierarchy-style";
  style.textContent = hierarchyStyles;
  document.head.append(style);
}

function closeHierarchy() {
  document.getElementById("oe-hierarchy-overlay")?.remove();
}

function shell(title: string, copy: string) {
  closeHierarchy();
  const overlay = document.createElement("div");
  overlay.id = "oe-hierarchy-overlay";
  overlay.className = "oe-hierarchy-overlay";
  overlay.innerHTML = `<div class="oe-hierarchy-shell">
    <div class="oe-hierarchy-head">
      <div><div class="oe-hierarchy-kicker">Odonto Excellence</div><h1>${esc(title)}</h1><p>${esc(copy)}</p></div>
      <button class="oe-hierarchy-close" aria-label="Fechar">×</button>
    </div>
    <div id="oe-hierarchy-content"><div class="oe-hierarchy-empty">Carregando estrutura...</div></div>
  </div>`;
  overlay.querySelector(".oe-hierarchy-close")?.addEventListener("click", closeHierarchy);
  document.body.append(overlay);
  return overlay.querySelector<HTMLElement>("#oe-hierarchy-content")!;
}

function statusButton(user: TeamUser) {
  return `<button class="oe-hierarchy-btn ${user.isActive ? "danger" : "primary"}" data-toggle-user="${esc(user.id)}" data-next-active="${user.isActive ? "false" : "true"}">${user.isActive ? "Suspender" : "Reativar"}</button>`;
}

async function renderTeamEnvironment(user: SessionUser) {
  const title = user.accountType === "supervisor" ? "Supervisão" : "Minha equipe";
  const copy = user.accountType === "supervisor"
    ? "Acompanhe seus gerentes e as equipes subordinadas. Seu acesso é limitado exclusivamente à estrutura atribuída a você."
    : "Administre sua equipe operacional sem acessar configurações globais do sistema.";
  const content = shell(title, copy);
  try {
    const payload = await api<TeamPayload>("/odonto-portal/hierarchy/team");
    const online = [...payload.managers, ...payload.members].filter((item) => item.online).length;
    content.innerHTML = `
      <div class="oe-hierarchy-stats">
        <div class="oe-hierarchy-stat"><small>Gerentes</small><strong>${payload.managers.length}</strong></div>
        <div class="oe-hierarchy-stat"><small>Colaboradores</small><strong>${payload.members.length}</strong></div>
        <div class="oe-hierarchy-stat"><small>Online agora</small><strong>${online}</strong></div>
        <div class="oe-hierarchy-stat"><small>Equipes</small><strong>${payload.managers.length}</strong></div>
      </div>
      <div class="oe-hierarchy-card">
        <div class="oe-hierarchy-card-head"><div><h2>Novo colaborador</h2><div class="oe-hierarchy-muted">Crie o acesso diretamente na equipe correta.</div></div></div>
        <form id="oe-hierarchy-create-member" class="oe-hierarchy-form">
          <input name="displayName" required maxlength="80" placeholder="Nome completo" />
          <input name="username" required maxlength="32" placeholder="Usuário" />
          <input name="password" required minlength="8" type="password" placeholder="Senha temporária" />
          ${user.accountType === "supervisor" ? `<select name="managerId" required><option value="">Selecione o gerente</option>${payload.managers.map((m) => `<option value="${esc(m.id)}">${esc(m.displayName)}</option>`).join("")}</select>` : ""}
          <button class="oe-hierarchy-btn primary" type="submit">Criar colaborador</button>
        </form>
        <div id="oe-hierarchy-form-error"></div>
      </div>
      <h2 class="oe-hierarchy-section-title">Estrutura sob sua responsabilidade</h2>
      <div class="oe-hierarchy-grid">
        ${payload.managers.map((manager) => {
          const members = payload.members.filter((member) => member.managerId === manager.id);
          return `<section class="oe-hierarchy-card">
            <div class="oe-hierarchy-card-head">
              <div><h3>${esc(manager.displayName)}</h3><div class="oe-hierarchy-muted">@${esc(manager.username)} · ${members.length} colaborador${members.length === 1 ? "" : "es"}</div></div>
              <div class="oe-hierarchy-actions"><span class="oe-hierarchy-badge ${manager.online ? "online" : ""}">${manager.online ? "Online" : "Offline"}</span>${user.accountType === "supervisor" ? statusButton(manager) : ""}</div>
            </div>
            <div class="oe-hierarchy-list">
              ${members.length ? members.map((member) => `<div class="oe-hierarchy-row"><div><div class="oe-hierarchy-name">${esc(member.displayName)}</div><div class="oe-hierarchy-muted">@${esc(member.username)} · ${member.isActive ? "Ativo" : "Suspenso"}</div></div><div class="oe-hierarchy-actions"><span class="oe-hierarchy-badge ${member.online ? "online" : ""}">${member.online ? "Online" : "Offline"}</span>${statusButton(member)}</div></div>`).join("") : `<div class="oe-hierarchy-empty">Nenhum colaborador nesta equipe.</div>`}
            </div>
          </section>`;
        }).join("") || `<div class="oe-hierarchy-card oe-hierarchy-empty">Nenhum gerente foi atribuído a este ambiente.</div>`}
      </div>`;

    content.querySelector<HTMLFormElement>("#oe-hierarchy-create-member")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const errorBox = content.querySelector<HTMLElement>("#oe-hierarchy-form-error")!;
      errorBox.innerHTML = "";
      try {
        await api("/odonto-portal/hierarchy/team/users", {
          method: "POST",
          body: JSON.stringify({
            displayName: data.get("displayName"), username: data.get("username"), password: data.get("password"), managerId: data.get("managerId"),
          }),
        });
        await renderTeamEnvironment(user);
      } catch (error) {
        errorBox.innerHTML = `<div class="oe-hierarchy-error">${esc(error instanceof Error ? error.message : "Não foi possível criar o acesso.")}</div>`;
      }
    });

    content.querySelectorAll<HTMLButtonElement>("[data-toggle-user]").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await api(`/odonto-portal/hierarchy/team/users/${encodeURIComponent(button.dataset.toggleUser || "")}`, {
            method: "PATCH",
            body: JSON.stringify({ isActive: button.dataset.nextActive === "true" }),
          });
          await renderTeamEnvironment(user);
        } catch (error) {
          button.disabled = false;
          window.alert(error instanceof Error ? error.message : "Não foi possível atualizar o acesso.");
        }
      });
    });
  } catch (error) {
    content.innerHTML = `<div class="oe-hierarchy-error">${esc(error instanceof Error ? error.message : "Não foi possível carregar sua estrutura.")}</div>`;
  }
}

async function renderCreatorStructure() {
  const content = shell("Estrutura organizacional", "Defina supervisores, distribua gerentes e vincule perfis que pertencem à mesma pessoa. Esta área permanece exclusiva do perfil de desenvolvimento.");
  try {
    const payload = await api<AdminPayload>("/odonto-portal/hierarchy/admin/overview");
    const supervisors = payload.users.filter((u) => u.accountType === "supervisor");
    const managers = payload.users.filter((u) => u.accountType === "manager");
    const active = payload.users.filter((u) => u.isActive).length;
    content.innerHTML = `
      <div class="oe-hierarchy-stats">
        <div class="oe-hierarchy-stat"><small>Perfis</small><strong>${payload.users.length}</strong></div>
        <div class="oe-hierarchy-stat"><small>Supervisores</small><strong>${supervisors.length}</strong></div>
        <div class="oe-hierarchy-stat"><small>Gerentes</small><strong>${managers.length}</strong></div>
        <div class="oe-hierarchy-stat"><small>Ativos</small><strong>${active}</strong></div>
      </div>

      <div class="oe-hierarchy-card">
        <h2>Vincular perfis da mesma pessoa</h2>
        <div class="oe-hierarchy-muted">Use isto para manter identidades pessoais coerentes sem compartilhar privilégios entre os logins.</div>
        <form id="oe-link-person" class="oe-hierarchy-form">
          <select name="primaryUserId" required><option value="">Perfil principal</option>${payload.users.map((u) => `<option value="${esc(u.id)}">${esc(u.displayName)} · @${esc(u.username)} · ${esc(u.accountType)}</option>`).join("")}</select>
          <select name="linkedUserId" required><option value="">Segundo perfil</option>${payload.users.map((u) => `<option value="${esc(u.id)}">${esc(u.displayName)} · @${esc(u.username)} · ${esc(u.accountType)}</option>`).join("")}</select>
          <button class="oe-hierarchy-btn primary" type="submit">Vincular perfis</button>
        </form>
      </div>

      <h2 class="oe-hierarchy-section-title">Supervisão dos gerentes</h2>
      <div class="oe-hierarchy-card">
        ${managers.length ? managers.map((manager) => {
          const relation = payload.relations.find((r) => r.managerId === manager.id);
          return `<div class="oe-hierarchy-row"><div><div class="oe-hierarchy-name">${esc(manager.displayName)}</div><div class="oe-hierarchy-muted">Gerente · @${esc(manager.username)}</div></div><div class="oe-hierarchy-actions"><select class="oe-hierarchy-select" data-manager-supervisor="${esc(manager.id)}"><option value="">Sem supervisor</option>${supervisors.map((s) => `<option value="${esc(s.id)}" ${relation?.supervisorId === s.id ? "selected" : ""}>${esc(s.displayName)}</option>`).join("")}</select></div></div>`;
        }).join("") : `<div class="oe-hierarchy-empty">Nenhum gerente disponível.</div>`}
      </div>

      <h2 class="oe-hierarchy-section-title">Perfis e níveis de acesso</h2>
      <div class="oe-hierarchy-card">
        ${payload.users.map((account) => `<div class="oe-hierarchy-row"><div><div class="oe-hierarchy-name">${esc(account.displayName)}</div><div class="oe-hierarchy-muted">@${esc(account.username)} · ${esc(account.accountStatus)}${account.personId ? ` · pessoa ${esc(account.personId.slice(0,8))}` : ""}</div></div><div class="oe-hierarchy-actions">${account.accountType === "creator" ? `<span class="oe-hierarchy-badge">Desenvolvimento</span>` : `<select class="oe-hierarchy-select" data-account-type="${esc(account.id)}"><option value="supervisor" ${account.accountType === "supervisor" ? "selected" : ""}>Supervisor</option><option value="manager" ${account.accountType === "manager" ? "selected" : ""}>Gerente</option><option value="individual" ${account.accountType === "individual" ? "selected" : ""}>Individual</option><option value="member" ${account.accountType === "member" ? "selected" : ""}>Membro</option></select><button class="oe-hierarchy-btn primary" data-apply-role="${esc(account.id)}">Aplicar</button>`}</div></div>`).join("")}
      </div>`;

    content.querySelector<HTMLFormElement>("#oe-link-person")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      try {
        await api("/odonto-portal/hierarchy/admin/link-person", { method: "POST", body: JSON.stringify({ primaryUserId: data.get("primaryUserId"), linkedUserId: data.get("linkedUserId") }) });
        await renderCreatorStructure();
      } catch (error) { window.alert(error instanceof Error ? error.message : "Não foi possível vincular os perfis."); }
    });

    content.querySelectorAll<HTMLSelectElement>("[data-manager-supervisor]").forEach((select) => {
      select.addEventListener("change", async () => {
        const managerId = select.dataset.managerSupervisor || "";
        const old = payload.relations.find((r) => r.managerId === managerId);
        select.disabled = true;
        try {
          if (old && old.supervisorId !== select.value) {
            await api(`/odonto-portal/hierarchy/admin/supervisors/${encodeURIComponent(old.supervisorId)}/managers/${encodeURIComponent(managerId)}`, { method: "DELETE" });
          }
          if (select.value) {
            await api(`/odonto-portal/hierarchy/admin/supervisors/${encodeURIComponent(select.value)}/managers/${encodeURIComponent(managerId)}`, { method: "PUT" });
          }
          await renderCreatorStructure();
        } catch (error) { select.disabled = false; window.alert(error instanceof Error ? error.message : "Não foi possível alterar a supervisão."); }
      });
    });

    content.querySelectorAll<HTMLButtonElement>("[data-apply-role]").forEach((button) => {
      button.addEventListener("click", async () => {
        const id = button.dataset.applyRole || "";
        const select = content.querySelector<HTMLSelectElement>(`[data-account-type="${CSS.escape(id)}"]`);
        if (!select) return;
        button.disabled = true;
        try {
          await api(`/odonto-portal/hierarchy/admin/users/${encodeURIComponent(id)}/account-type`, { method: "PATCH", body: JSON.stringify({ accountType: select.value, activate: true }) });
          await renderCreatorStructure();
        } catch (error) { button.disabled = false; window.alert(error instanceof Error ? error.message : "Não foi possível alterar o perfil."); }
      });
    });
  } catch (error) {
    content.innerHTML = `<div class="oe-hierarchy-error">${esc(error instanceof Error ? error.message : "Não foi possível carregar a estrutura.")}</div>`;
  }
}

function makeNavButton(user: SessionUser) {
  const creator = user.accountType === "creator";
  const operational = user.accountType === "supervisor" || user.accountType === "manager";
  if (!creator && !operational) return;
  const label = creator ? "Estrutura" : user.accountType === "supervisor" ? "Supervisão" : "Minha equipe";
  const handler = () => creator ? void renderCreatorStructure() : void renderTeamEnvironment(user);

  document.querySelectorAll<HTMLAnchorElement>('a[href="/admin"]').forEach((anchor) => {
    if (!creator) anchor.style.display = "none";
  });

  document.querySelectorAll<HTMLElement>(".sidebar").forEach((sidebar) => {
    if (sidebar.querySelector("[data-oe-hierarchy-nav]")) return;
    const navs = sidebar.querySelectorAll<HTMLElement>(".nav-section nav");
    const nav = navs[navs.length - 1];
    if (!nav) return;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.oeHierarchyNav = "true";
    button.className = "nav-item oe-hierarchy-nav";
    button.innerHTML = `<span aria-hidden="true">◇</span><span>${esc(label)}</span>`;
    button.addEventListener("click", handler);
    nav.append(button);
  });

  document.querySelectorAll<HTMLElement>(".mobile-menu").forEach((menu) => {
    if (menu.querySelector("[data-oe-hierarchy-mobile]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.oeHierarchyMobile = "true";
    button.className = "nav-item oe-hierarchy-mobile";
    button.innerHTML = `<span aria-hidden="true">◇</span><span>${esc(label)}</span>`;
    button.addEventListener("click", handler);
    menu.append(button);
  });
}

export function installHierarchyEnhancements() {
  installStyle();
  let cachedUser: SessionUser | null = null;
  let loading = false;

  const refresh = async () => {
    if (loading) return;
    loading = true;
    try {
      const response = await api<{ user: SessionUser | null }>("/odonto-portal/auth/me");
      cachedUser = response.user;
      if (cachedUser) makeNavButton(cachedUser);
    } catch {
      cachedUser = null;
    } finally {
      loading = false;
    }
  };

  void refresh();
  const observer = new MutationObserver(() => {
    if (cachedUser) makeNavButton(cachedUser);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(() => void refresh(), 60_000);
}
