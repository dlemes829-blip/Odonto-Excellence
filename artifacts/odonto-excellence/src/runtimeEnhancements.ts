const PORTAL_API_URL = (
  import.meta.env.VITE_ODONTO_API_URL ??
  "https://odonto-excellence-api.onrender.com/api"
).replace(/\/$/, "");

type TrainingItem = {
  id: string;
  title: string;
  durationMinutes: number;
  area?: string;
  ownerId?: string;
};

type PortalStateEnvelope = {
  state: Record<string, unknown> | null;
  revision: number;
};

type TrainingMetadata = {
  title: string;
  durationMinutes: number;
  notes: string;
  updatedAt: string;
};

type TrainingMetadataEnvelope = {
  videos: Record<string, TrainingMetadata>;
};

const runtimeStyle = `
@media (max-width: 767px) {
  .mobile-menu {
    background: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    border-radius: 12px;
    padding: 8px !important;
    margin-top: 8px;
    box-shadow: 0 8px 24px hsl(var(--foreground) / 0.08);
  }
  .mobile-menu .nav-item {
    color: hsl(var(--foreground)) !important;
    background: hsl(var(--secondary)) !important;
    border: 1px solid hsl(var(--border));
    opacity: 1 !important;
    box-shadow: none !important;
  }
  .mobile-menu .nav-item svg {
    color: hsl(var(--primary)) !important;
  }
  .mobile-menu .nav-item.active {
    color: hsl(var(--primary-foreground)) !important;
    background: hsl(var(--primary)) !important;
    border-color: hsl(var(--primary)) !important;
  }
  .mobile-menu .nav-item.active svg {
    color: hsl(var(--primary-foreground)) !important;
  }
}

#oe-training-editor {
  margin-top: 20px;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  border-radius: 16px;
  padding: 18px;
}
#oe-training-editor .oe-editor-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
#oe-training-editor .oe-editor-title {
  font-size: 15px;
  font-weight: 800;
  color: hsl(var(--foreground));
}
#oe-training-editor .oe-editor-copy,
#oe-training-editor .oe-editor-status {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  margin-top: 4px;
}
#oe-training-editor .oe-video-edit-card {
  border-top: 1px solid hsl(var(--border));
  padding: 14px 0;
}
#oe-training-editor .oe-video-edit-card:first-of-type {
  border-top: 0;
}
#oe-training-editor .oe-form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px;
  gap: 10px;
}
#oe-training-editor label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: hsl(var(--muted-foreground));
}
#oe-training-editor input,
#oe-training-editor textarea {
  width: 100%;
  margin-top: 6px;
  border: 1px solid hsl(var(--input));
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  border-radius: 10px;
  padding: 10px 11px;
  outline: none;
}
#oe-training-editor input:focus,
#oe-training-editor textarea:focus {
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 3px hsl(var(--ring) / 0.12);
}
#oe-training-editor textarea {
  min-height: 92px;
  resize: vertical;
}
#oe-training-editor .oe-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
#oe-training-editor button {
  min-height: 38px;
  border-radius: 9px;
  padding: 0 13px;
  font-size: 11px;
  font-weight: 800;
}
#oe-training-editor .oe-save {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}
#oe-training-editor .oe-refresh {
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
  border: 1px solid hsl(var(--border));
}
@media (max-width: 640px) {
  #oe-training-editor .oe-form-grid { grid-template-columns: 1fr; }
}
`;

function installRuntimeStyle() {
  if (document.getElementById("oe-runtime-enhancements-style")) return;
  const style = document.createElement("style");
  style.id = "oe-runtime-enhancements-style";
  style.textContent = runtimeStyle;
  document.head.append(style);
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function hardenAdminSearch() {
  const input = document.querySelector<HTMLInputElement>(
    'input[name="admin-account-filter"], input[data-oe-admin-search="true"]',
  );
  if (!input || input.dataset.oeAutofillFixed === "true") return;

  input.dataset.oeAutofillFixed = "true";
  input.dataset.oeAdminSearch = "true";
  input.name = `oe-user-filter-${crypto.randomUUID()}`;
  input.autocomplete = "off";
  input.setAttribute("aria-autocomplete", "none");
  input.setAttribute("data-lpignore", "true");
  input.setAttribute("data-1p-ignore", "true");
  input.setAttribute("data-form-type", "other");
  input.readOnly = true;

  let touched = false;
  const unlock = () => {
    input.readOnly = false;
    if (!touched && input.value) setNativeInputValue(input, "");
    touched = true;
  };
  input.addEventListener("pointerdown", unlock, { once: true });
  input.addEventListener("focus", unlock, { once: true });
  input.addEventListener("keydown", () => {
    touched = true;
    input.readOnly = false;
  }, { once: true });

  for (const delay of [0, 80, 250, 700]) {
    window.setTimeout(() => {
      if (!touched && input.value) setNativeInputValue(input, "");
    }, delay);
  }
}

function removeTrainingAreaField() {
  if (!location.pathname.includes("treinamento")) return;
  document.querySelectorAll<HTMLSpanElement>(".label-text").forEach((label) => {
    if (label.textContent?.trim().toLocaleLowerCase("pt-BR") !== "área") return;
    const wrapper = label.closest("label") as HTMLElement | null;
    if (!wrapper) return;
    wrapper.style.display = "none";
    const grid = wrapper.parentElement;
    if (grid?.classList.contains("grid")) grid.style.gridTemplateColumns = "1fr";
  });
}

async function fetchPortalState(): Promise<PortalStateEnvelope> {
  const response = await fetch(`${PORTAL_API_URL}/odonto-portal/state`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Não foi possível carregar os vídeos.");
  return (await response.json()) as PortalStateEnvelope;
}

async function fetchTrainingMetadata(): Promise<TrainingMetadataEnvelope> {
  const response = await fetch(
    `${PORTAL_API_URL}/odonto-portal/training-metadata`,
    { credentials: "include", cache: "no-store" },
  );
  if (!response.ok) throw new Error("Não foi possível carregar as observações.");
  return (await response.json()) as TrainingMetadataEnvelope;
}

async function saveTrainingMetadata(
  videoId: string,
  payload: { title: string; durationMinutes: number; notes: string },
) {
  const response = await fetch(
    `${PORTAL_API_URL}/odonto-portal/training-metadata/${encodeURIComponent(videoId)}`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(body.error || "Falha ao salvar observação.");
}

async function updateTrainingState(
  videoId: string,
  title: string,
  durationMinutes: number,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const envelope = await fetchPortalState();
    if (!envelope.state) throw new Error("Estado do portal ainda não foi criado.");
    const training = Array.isArray(envelope.state.training)
      ? (envelope.state.training as TrainingItem[])
      : [];
    const found = training.some((item) => item.id === videoId);
    if (!found) throw new Error("Vídeo não encontrado no estado do portal.");

    const nextState = {
      ...envelope.state,
      training: training.map((item) =>
        item.id === videoId ? { ...item, title, durationMinutes } : item,
      ),
    };
    const response = await fetch(`${PORTAL_API_URL}/odonto-portal/state`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: nextState, revision: envelope.revision }),
    });
    if (response.ok) return;
    if (response.status !== 409) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || "Falha ao atualizar o vídeo.");
    }
  }
  throw new Error("O vídeo mudou em outra sessão. Tente salvar novamente.");
}

let trainingEditorLoading = false;
let trainingEditorLastSignature = "";

async function renderTrainingEditor(force = false) {
  if (!location.pathname.includes("treinamento")) return;
  const content = document.querySelector<HTMLElement>(".content-wrap");
  if (!content || trainingEditorLoading) return;
  const existing = document.getElementById("oe-training-editor");
  if (
    existing &&
    !force &&
    existing.contains(document.activeElement)
  ) return;

  trainingEditorLoading = true;
  try {
    const [envelope, metadata] = await Promise.all([
      fetchPortalState(),
      fetchTrainingMetadata(),
    ]);
    const training = Array.isArray(envelope.state?.training)
      ? (envelope.state?.training as TrainingItem[])
      : [];
    const signature = JSON.stringify({ training, videos: metadata.videos });
    if (!force && existing && signature === trainingEditorLastSignature) return;
    trainingEditorLastSignature = signature;

    const panel = existing ?? document.createElement("section");
    panel.id = "oe-training-editor";
    panel.innerHTML = "";

    const head = document.createElement("div");
    head.className = "oe-editor-head";
    head.innerHTML = `
      <div>
        <div class="oe-editor-title">Editar vídeos e observações</div>
        <div class="oe-editor-copy">Alterações são salvas no banco assim que você confirmar. As observações ficam preservadas separadamente para uso futuro pelo agente de aprendizagem.</div>
        <div class="oe-editor-status">Sincronizado ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
      </div>
    `;
    const refresh = document.createElement("button");
    refresh.type = "button";
    refresh.className = "oe-refresh";
    refresh.textContent = "Atualizar";
    refresh.addEventListener("click", () => void renderTrainingEditor(true));
    head.append(refresh);
    panel.append(head);

    if (!training.length) {
      const empty = document.createElement("div");
      empty.className = "oe-editor-copy";
      empty.textContent = "Nenhum vídeo cadastrado neste ambiente.";
      panel.append(empty);
    }

    training.forEach((video) => {
      const saved = metadata.videos[video.id];
      const card = document.createElement("form");
      card.className = "oe-video-edit-card";
      card.innerHTML = `
        <div class="oe-form-grid">
          <label>Título
            <input name="title" maxlength="120" required value="${escapeHtml(saved?.title || video.title)}" />
          </label>
          <label>Minutos
            <input name="minutes" type="number" min="1" max="720" required value="${saved?.durationMinutes || video.durationMinutes || 1}" />
          </label>
        </div>
        <label style="margin-top:10px">Observação
          <textarea name="notes" maxlength="4000" placeholder="Pontos importantes, resumo, dúvidas, referências para estudo...">${escapeHtml(saved?.notes || "")}</textarea>
        </label>
        <div class="oe-editor-actions"><button type="submit" class="oe-save">Salvar alterações</button></div>
      `;
      card.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = card.querySelector<HTMLButtonElement>(".oe-save");
        const titleInput = card.querySelector<HTMLInputElement>('input[name="title"]');
        const minutesInput = card.querySelector<HTMLInputElement>('input[name="minutes"]');
        const notesInput = card.querySelector<HTMLTextAreaElement>('textarea[name="notes"]');
        if (!button || !titleInput || !minutesInput || !notesInput) return;
        const title = titleInput.value.trim();
        const durationMinutes = Math.max(1, Math.min(720, Number(minutesInput.value) || 1));
        const notes = notesInput.value.trim();
        if (!title) return;
        button.disabled = true;
        button.textContent = "Salvando...";
        try {
          await saveTrainingMetadata(video.id, { title, durationMinutes, notes });
          await updateTrainingState(video.id, title, durationMinutes);
          button.textContent = "Salvo";
          window.setTimeout(() => window.location.reload(), 350);
        } catch (error) {
          button.disabled = false;
          button.textContent = "Tentar novamente";
          window.alert(error instanceof Error ? error.message : "Não foi possível salvar.");
        }
      });
      panel.append(card);
    });

    if (!existing) {
      const firstPanel = content.querySelector(".panel");
      if (firstPanel?.parentElement === content) {
        firstPanel.insertAdjacentElement("afterend", panel);
      } else {
        content.prepend(panel);
      }
    }
  } catch {
    // The authenticated app remains usable even if this enhancement endpoint is unavailable.
  } finally {
    trainingEditorLoading = false;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function refreshEnhancements() {
  hardenAdminSearch();
  removeTrainingAreaField();
  void renderTrainingEditor();
}

export function installRuntimeEnhancements() {
  installRuntimeStyle();
  refreshEnhancements();

  const observer = new MutationObserver(() => refreshEnhancements());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("popstate", refreshEnhancements);
  window.addEventListener("focus", refreshEnhancements);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshEnhancements();
  });

  window.setInterval(() => {
    if (location.pathname.includes("treinamento")) void renderTrainingEditor();
  }, 4000);
}
