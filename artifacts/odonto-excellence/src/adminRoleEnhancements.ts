type AccountType = "creator" | "supervisor" | "manager" | "member" | "individual";

const API_URL = (
  import.meta.env.VITE_ODONTO_API_URL ??
  "https://odonto-excellence-api.onrender.com/api"
).replace(/\/$/, "");

function roleLabel(type: string) {
  if (type === "supervisor") return "Supervisor";
  if (type === "manager") return "Gerente";
  if (type === "individual") return "Individual";
  if (type === "member") return "Membro da equipe";
  return type;
}

async function currentAccountType(): Promise<AccountType | null> {
  try {
    const response = await fetch(`${API_URL}/odonto-portal/hierarchy/me`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { user?: { accountType?: AccountType } };
    return body.user?.accountType ?? null;
  } catch {
    return null;
  }
}

function refineRoleControls(root: ParentNode) {
  root.querySelectorAll<HTMLSelectElement>("[data-account-type]").forEach((select) => {
    if (select.dataset.oeRoleRefined === "true") return;
    select.dataset.oeRoleRefined = "true";

    const current = select.value;
    const memberOption = Array.from(select.options).find((option) => option.value === "member");
    if (memberOption) {
      memberOption.textContent = "Membro da equipe";
      memberOption.disabled = current !== "member";
    }

    select.setAttribute("aria-label", "Nível de acesso");
    select.title = "Somente o administrador pode alterar este nível de acesso.";
  });

  root.querySelectorAll<HTMLButtonElement>("[data-apply-role]").forEach((button) => {
    if (button.dataset.oeRoleConfirmed === "true") return;
    button.dataset.oeRoleConfirmed = "true";

    button.addEventListener(
      "click",
      (event) => {
        const id = button.dataset.applyRole || "";
        const select = root.querySelector<HTMLSelectElement>(`[data-account-type="${CSS.escape(id)}"]`);
        if (!select) return;

        const row = button.closest(".oe-hierarchy-row");
        const name = row?.querySelector(".oe-hierarchy-name")?.textContent?.trim() || "este usuário";
        const next = roleLabel(select.value);
        const confirmed = window.confirm(
          `Alterar o acesso de ${name} para ${next}?\n\nA sessão atual desse usuário será encerrada e as novas permissões valerão no próximo login.`,
        );
        if (!confirmed) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true,
    );
  });
}

function installCreatorHelper(root: HTMLElement) {
  if (root.querySelector("[data-oe-admin-role-note]")) return;
  const title = Array.from(root.querySelectorAll<HTMLElement>(".oe-hierarchy-section-title")).find((node) =>
    node.textContent?.includes("Perfis e níveis de acesso"),
  );
  if (!title) return;

  const note = document.createElement("div");
  note.dataset.oeAdminRoleNote = "true";
  note.className = "oe-hierarchy-card";
  note.style.marginTop = "10px";
  note.innerHTML = `
    <div class="oe-hierarchy-card-head">
      <div>
        <h3>Controle de acesso</h3>
        <div class="oe-hierarchy-muted">Promova ou altere usuários entre Supervisor, Gerente e Individual. Membros permanecem vinculados às equipes e podem ser promovidos quando necessário.</div>
      </div>
    </div>`;
  title.insertAdjacentElement("afterend", note);
}

export function installAdminRoleEnhancements() {
  let creator = false;

  void currentAccountType().then((type) => {
    creator = type === "creator";
  });

  const observer = new MutationObserver(() => {
    const overlay = document.getElementById("oe-hierarchy-overlay");
    if (!overlay || !creator) return;
    refineRoleControls(overlay);
    installCreatorHelper(overlay);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
}
