type AccountType = "creator" | "supervisor" | "manager" | "member" | "individual";
type AdminUser = { id: string; personId: string | null; username: string; displayName: string; accountType: AccountType; accountStatus: string; managerId: string | null; isActive: boolean };
type AdminOverview = { users: AdminUser[]; relations: Array<{ supervisorId: string; managerId: string }> };

const API_URL = (import.meta.env.VITE_ODONTO_API_URL ?? "https://odonto-excellence-api.onrender.com/api").replace(/\/$/, "");
const ROOT_ID = "oe-admin-structure";

function esc(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { credentials: "include", cache: "no-store", ...init, headers: init?.body ? { "Content-Type": "application/json", ...(init.headers || {}) } : init?.headers });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "Não foi possível concluir esta operação.");
  return body;
}

function installStyle() {
  if (document.getElementById("oe-admin-structure-style")) return;
  const style = document.createElement("style");
  style.id = "oe-admin-structure-style";
  style.textContent = `#${ROOT_ID}{margin-top:24px}.oe-as-head{margin-bottom:16px}.oe-as-title{font-size:20px;font-weight:900;letter-spacing:-.025em}.oe-as-copy,.oe-as-muted,.oe-as-meta{color:hsl(var(--muted-foreground));font-size:11px}.oe-as-copy{margin-top:6px;max-width:760px;line-height:1.55}.oe-as-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.oe-as-card,.oe-as-section{border:1px solid hsl(var(--border));background:hsl(var(--card));border-radius:16px;padding:16px}.oe-as-section{margin-top:12px}.oe-as-card h3,.oe-as-subtitle{font-size:13px;font-weight:900;margin:0}.oe-as-stat{font-size:28px;font-weight:900;letter-spacing:-.04em;margin-top:9px}.oe-as-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,300px);gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid hsl(var(--border))}.oe-as-row:last-child{border-bottom:0}.oe-as-name{font-size:12px;font-weight:850}.oe-as-select{width:100%;min-height:38px;border:1px solid hsl(var(--input));background:hsl(var(--background));color:hsl(var(--foreground));border-radius:10px;padding:0 10px;font-size:11px}.oe-as-actions{display:flex;gap:8px;align-items:center}.oe-as-btn{min-height:38px;border-radius:10px;border:1px solid hsl(var(--border));padding:0 12px;font-size:10px;font-weight:850;background:hsl(var(--secondary));color:hsl(var(--secondary-foreground))}.oe-as-btn.primary{background:hsl(var(--primary));color:hsl(var(--primary-foreground));border-color:hsl(var(--primary))}.oe-as-form{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;margin-top:12px}.oe-as-error{padding:10px 12px;border-radius:10px;background:hsl(var(--destructive)/.08);color:hsl(var(--destructive));font-size:11px;font-weight:700}@media(max-width:850px){.oe-as-grid{grid-template-columns:1fr}.oe-as-row{grid-template-columns:1fr}.oe-as-form{grid-template-columns:1fr}.oe-as-actions>*{flex:1}}`;
  document.head.append(style);
}

async function creator() {
  try { const result = await api<{ user?: { accountType?: AccountType } }>("/odonto-portal/hierarchy/me"); return result.user?.accountType === "creator"; } catch { return false; }
}

function hideStructureNav() {
  document.querySelectorAll<HTMLElement>("[data-oe-hierarchy-nav], [data-oe-hierarchy-mobile]").forEach((node) => { node.style.display = "none"; });
}

function onAdmin() { return window.location.pathname === "/admin" || window.location.pathname.endsWith("/admin"); }

async function render(root: HTMLElement) {
  root.innerHTML = `<section class="oe-as-section"><div class="oe-as-muted">Carregando estrutura organizacional...</div></section>`;
  try {
    const data = await api<AdminOverview>("/odonto-portal/hierarchy/admin/overview");
    const supervisors = data.users.filter((u) => u.accountType === "supervisor");
    const managers = data.users.filter((u) => u.accountType === "manager");
    const members = data.users.filter((u) => u.accountType === "member");

    root.innerHTML = `<div class="oe-as-head"><div class="oe-as-title">Estrutura e acessos</div><div class="oe-as-copy">Organize a hierarquia no mesmo lugar em que você administra usuários. Supervisores enxergam apenas os gerentes atribuídos e as equipes abaixo deles; Desenvolvimento continua com controle global.</div></div>
      <div class="oe-as-grid"><div class="oe-as-card"><h3>Supervisores</h3><div class="oe-as-stat">${supervisors.length}</div><div class="oe-as-muted">gestão acima dos gerentes</div></div><div class="oe-as-card"><h3>Gerentes</h3><div class="oe-as-stat">${managers.length}</div><div class="oe-as-muted">equipes operacionais</div></div><div class="oe-as-card"><h3>Colaboradores</h3><div class="oe-as-stat">${members.length}</div><div class="oe-as-muted">membros vinculados às equipes</div></div></div>
      <section class="oe-as-section"><div class="oe-as-subtitle">Níveis de acesso</div><div class="oe-as-muted">Somente seu perfil de desenvolvimento pode alterar papéis organizacionais.</div>${data.users.map((u) => `<div class="oe-as-row"><div><div class="oe-as-name">${esc(u.displayName)}</div><div class="oe-as-meta">@${esc(u.username)} · ${esc(u.accountStatus)}</div></div><div class="oe-as-actions">${u.accountType === "creator" ? `<span class="oe-as-btn">Desenvolvimento</span>` : `<select class="oe-as-select" data-role-user="${esc(u.id)}" data-current-role="${esc(u.accountType)}"><option value="supervisor" ${u.accountType === "supervisor" ? "selected" : ""}>Supervisor</option><option value="manager" ${u.accountType === "manager" ? "selected" : ""}>Gerente</option><option value="individual" ${u.accountType === "individual" ? "selected" : ""}>Individual</option>${u.accountType === "member" ? `<option value="member" selected>Membro da equipe</option>` : ""}</select><button class="oe-as-btn primary" data-apply-role="${esc(u.id)}">Aplicar</button>`}</div></div>`).join("")}</section>
      <section class="oe-as-section"><div class="oe-as-subtitle">Supervisão dos gerentes</div><div class="oe-as-muted">Sua supervisora pode ser criada depois. Até lá, o gerente permanece sem vínculo superior.</div>${managers.map((m) => { const relation = data.relations.find((r) => r.managerId === m.id); return `<div class="oe-as-row"><div><div class="oe-as-name">${esc(m.displayName)}</div><div class="oe-as-meta">Gerente · @${esc(m.username)}</div></div><select class="oe-as-select" data-manager-supervisor="${esc(m.id)}" data-current-supervisor="${esc(relation?.supervisorId || "")}"><option value="">Sem supervisor</option>${supervisors.map((s) => `<option value="${esc(s.id)}" ${relation?.supervisorId === s.id ? "selected" : ""}>${esc(s.displayName)}</option>`).join("")}</select></div>`; }).join("") || `<div class="oe-as-muted" style="margin-top:12px">Nenhum gerente disponível.</div>`}</section>
      <section class="oe-as-section"><div class="oe-as-subtitle">Perfis da mesma pessoa</div><div class="oe-as-muted">Vincule dois logins quando a mesma pessoa tiver papéis diferentes. Permissões, sessões e equipes continuam independentes.</div><form id="oe-as-link" class="oe-as-form"><select name="primaryUserId" class="oe-as-select" required><option value="">Perfil principal</option>${data.users.map((u) => `<option value="${esc(u.id)}">${esc(u.displayName)} · @${esc(u.username)} · ${esc(u.accountType)}</option>`).join("")}</select><select name="secondaryUserId" class="oe-as-select" required><option value="">Segundo perfil</option>${data.users.map((u) => `<option value="${esc(u.id)}">${esc(u.displayName)} · @${esc(u.username)} · ${esc(u.accountType)}</option>`).join("")}</select><button class="oe-as-btn primary">Vincular perfis</button></form></section>`;

    root.querySelectorAll<HTMLButtonElement>("[data-apply-role]").forEach((button) => button.addEventListener("click", async () => {
      const id = button.dataset.applyRole || "";
      const select = root.querySelector<HTMLSelectElement>(`[data-role-user="${CSS.escape(id)}"]`);
      if (!select || select.value === select.dataset.currentRole) return;
      const name = button.closest(".oe-as-row")?.querySelector(".oe-as-name")?.textContent || "este usuário";
      if (!window.confirm(`Alterar o acesso de ${name} para ${select.options[select.selectedIndex]?.text}?\n\nA sessão será encerrada e as novas permissões valerão no próximo login.`)) return;
      button.disabled = true;
      try { await api(`/odonto-portal/hierarchy/admin/users/${encodeURIComponent(id)}/account-type`, { method: "PATCH", body: JSON.stringify({ accountType: select.value }) }); await render(root); }
      catch (error) { button.disabled = false; window.alert(error instanceof Error ? error.message : "Não foi possível alterar o acesso."); }
    }));

    root.querySelectorAll<HTMLSelectElement>("[data-manager-supervisor]").forEach((select) => select.addEventListener("change", async () => {
      const managerId = select.dataset.managerSupervisor || "";
      const previous = select.dataset.currentSupervisor || "";
      const next = select.value;
      select.disabled = true;
      try {
        if (previous && previous !== next) await api(`/odonto-portal/hierarchy/admin/supervisors/${encodeURIComponent(previous)}/managers/${encodeURIComponent(managerId)}`, { method: "DELETE" });
        if (next) await api(`/odonto-portal/hierarchy/admin/supervisors/${encodeURIComponent(next)}/managers/${encodeURIComponent(managerId)}`, { method: "PUT" });
        await render(root);
      } catch (error) { select.disabled = false; window.alert(error instanceof Error ? error.message : "Não foi possível alterar a supervisão."); }
    }));

    root.querySelector<HTMLFormElement>("#oe-as-link")?.addEventListener("submit", async (event) => {
      event.preventDefault(); const values = new FormData(event.currentTarget); const primaryUserId = String(values.get("primaryUserId") || ""); const secondaryUserId = String(values.get("secondaryUserId") || "");
      if (!primaryUserId || !secondaryUserId || primaryUserId === secondaryUserId) { window.alert("Selecione dois perfis diferentes."); return; }
      try { await api("/odonto-portal/hierarchy/admin/link-person", { method: "POST", body: JSON.stringify({ primaryUserId, secondaryUserId }) }); await render(root); }
      catch (error) { window.alert(error instanceof Error ? error.message : "Não foi possível vincular os perfis."); }
    });
  } catch (error) { root.innerHTML = `<section class="oe-as-section"><div class="oe-as-error">${esc(error instanceof Error ? error.message : "Não foi possível carregar a estrutura organizacional.")}</div></section>`; }
}

async function mount() {
  if (!onAdmin() || !(await creator())) return;
  hideStructureNav();
  if (document.getElementById(ROOT_ID)) return;
  const content = document.querySelector<HTMLElement>(".content-wrap");
  if (!content) return;
  const root = document.createElement("div"); root.id = ROOT_ID; content.append(root); await render(root);
}

export function installAdminStructureIntegration() {
  installStyle(); let creatorKnown = false;
  void creator().then((isCreator) => { creatorKnown = isCreator; if (isCreator) { hideStructureNav(); void mount(); } });
  new MutationObserver(() => { if (!creatorKnown) return; hideStructureNav(); if (onAdmin()) void mount(); else document.getElementById(ROOT_ID)?.remove(); }).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", () => { if (creatorKnown && onAdmin()) void mount(); });
}
