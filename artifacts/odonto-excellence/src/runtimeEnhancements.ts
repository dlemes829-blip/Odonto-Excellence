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

.oe-video-note {
  margin-top: 7px;
  max-width: 760px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.oe-video-note:empty {
  display: none;
}

.oe-video-edit-trigger {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  display: inline-grid;
  place-items: center;
  border-radius: 10px;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  color: hsl(var(--primary));
  font-size: 22px;
  font-weight: 400;
  line-height: 1;
  transition: background 0.18s, border-color 0.18s, transform 0.18s;
}

.oe-video-edit-trigger:hover {
  background: hsl(var(--primary) / 0.07);
  border-color: hsl(var(--primary) / 0.35);
  transform: translateY(-1px);
}

.oe-video-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(10, 10, 12, 0.58);
  backdrop-filter: blur(5px);
}

.oe-video-modal {
  width: min(100%, 560px);
  border: 1px solid hsl(var(--border));
  border-radius: 18px;
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.28);
  overflow: hidden;
}

.oe-video-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 22px 18px;
  border-bottom: 1px solid hsl(var(--border));
}

.oe-video-modal-head h2 {
  margin: 0;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.oe-video-modal-head p {
  margin: 6px 0 0;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.5;
}

.oe-video-modal-close {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  flex: 0 0 34px;
  border-radius: 9px;
  color: hsl(var(--muted-foreground));
  font-size: 23px;
  line-height: 1;
}

.oe-video-modal-close:hover {
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.oe-video-modal-form {
  padding: 20px 22px 22px;
}

.oe-video-modal-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 130px;
  gap: 12px;
}

.oe-video-modal label {
  display: block;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 800;
}

.oe-video-modal input,
.oe-video-modal textarea {
  width: 100%;
  margin-top: 7px;
  border: 1px solid hsl(var(--input));
  border-radius: 11px;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  padding: 11px 12px;
  outline: none;
}

.oe-video-modal textarea {
  min-height: 120px;
  resize: vertical;
  line-height: 1.55;
}

.oe-video-modal input:focus,
.oe-video-modal textarea:focus {
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 3px hsl(var(--ring) / 0.12);
}

.oe-video-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 18px;
}

.oe-video-modal-actions button {
  min-height: 40px;
  border-radius: 10px;
  padding: 0 15px;
  font-size: 12px;
  font-weight: 800;
}

.oe-video-modal-cancel {
  border: 1px solid hsl(var(--border));
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
}

.oe-video-modal-save {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.oe-video-modal-save:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.oe-video-modal-error {
  margin-top: 12px;
  color: hsl(var(--destructive));
  font-size: 11px;
  font-weight: 700;
}

@media (max-width: 640px) {
  .oe-video-modal-grid {
    grid-template-columns: 1fr;
  }
  .oe-video-modal-backdrop {
    padding: 12px;
  }
  .oe-video-modal-head,
  .oe-video-modal-form {
    padding-left: 17px;
    padding-right: 17px;
  }
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
  input.addEventListener(
    "keydown",
    () => {
      touched = true;
      input.readOnly = false;
    },
    { once: true },
  );

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
  if (!response.ok) throw new Error(body.error || "Não foi possível atualizar o vídeo.");
}

async function updateTrainingState(
  videoId: string,
  title: string,
  durationMinutes: number,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const envelope = await fetchPortalState();
    if (!envelope.state) throw new Error("Não foi possível atualizar o vídeo.");
    const training = Array.isArray(envelope.state.training)
      ? (envelope.state.training as TrainingItem[])
      : [];
    const found = training.some((item) => item.id === videoId);
    if (!found) throw new Error("Vídeo não encontrado.");

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
      throw new Error(body.error || "Não foi possível atualizar o vídeo.");
    }
  }
  throw new Error("O vídeo foi alterado em outra sessão. Tente novamente.");
}

function getTrainingSection() {
  const heading = Array.from(document.querySelectorAll<HTMLElement>("h2")).find(
    (element) => element.textContent?.trim() === "Aulas para o dia a dia",
  );
  return heading?.closest("section") as HTMLElement | null;
}

function getVisibleTrainingRows(section: HTMLElement) {
  return Array.from(section.children).filter((child): child is HTMLElement => {
    if (!(child instanceof HTMLElement)) return false;
    return child.classList.contains("border-t") && child.classList.contains("flex");
  });
}

function findRowTitleElement(row: HTMLElement) {
  return Array.from(row.querySelectorAll<HTMLElement>("div")).find((element) => {
    const text = element.textContent?.trim() ?? "";
    if (!text) return false;
    if (element.children.length > 0) return false;
    return element.classList.contains("font-bold") && element.classList.contains("text-sm");
  }) ?? null;
}

function matchVideoForRow(
  row: HTMLElement,
  training: TrainingItem[],
  metadata: TrainingMetadataEnvelope,
) {
  const titleElement = findRowTitleElement(row);
  const rowTitle = titleElement?.textContent?.trim() ?? "";
  if (!rowTitle) return null;
  return (
    training.find((video) => video.title === rowTitle) ??
    training.find((video) => metadata.videos[video.id]?.title === rowTitle) ??
    null
  );
}

function closeVideoModal() {
  document.getElementById("oe-video-modal-backdrop")?.remove();
}

function openVideoModal(
  video: TrainingItem,
  metadata: TrainingMetadataEnvelope,
  onUpdated: () => Promise<void>,
) {
  closeVideoModal();
  const saved = metadata.videos[video.id];
  const backdrop = document.createElement("div");
  backdrop.id = "oe-video-modal-backdrop";
  backdrop.className = "oe-video-modal-backdrop";

  const modal = document.createElement("div");
  modal.className = "oe-video-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "oe-video-modal-title");

  const head = document.createElement("div");
  head.className = "oe-video-modal-head";
  head.innerHTML = `
    <div>
      <h2 id="oe-video-modal-title">Detalhes do vídeo</h2>
      <p>Atualize as informações que ajudam a equipe a entender e revisar este conteúdo.</p>
    </div>
  `;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "oe-video-modal-close";
  close.setAttribute("aria-label", "Fechar");
  close.textContent = "×";
  close.addEventListener("click", closeVideoModal);
  head.append(close);

  const form = document.createElement("form");
  form.className = "oe-video-modal-form";
  form.innerHTML = `
    <div class="oe-video-modal-grid">
      <label>Título
        <input name="title" maxlength="120" required value="${escapeHtml(saved?.title || video.title)}" />
      </label>
      <label>Duração (min)
        <input name="minutes" type="number" min="1" max="720" required value="${saved?.durationMinutes || video.durationMinutes || 1}" />
      </label>
    </div>
    <label style="margin-top:14px">Observação
      <textarea name="notes" maxlength="4000" placeholder="Resumo, pontos importantes, orientações ou informações complementares.">${escapeHtml(saved?.notes || "")}</textarea>
    </label>
    <div class="oe-video-modal-error" hidden></div>
    <div class="oe-video-modal-actions">
      <button type="button" class="oe-video-modal-cancel">Cancelar</button>
      <button type="submit" class="oe-video-modal-save">Salvar</button>
    </div>
  `;

  form.querySelector<HTMLButtonElement>(".oe-video-modal-cancel")?.addEventListener(
    "click",
    closeVideoModal,
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const titleInput = form.querySelector<HTMLInputElement>('input[name="title"]');
    const minutesInput = form.querySelector<HTMLInputElement>('input[name="minutes"]');
    const notesInput = form.querySelector<HTMLTextAreaElement>('textarea[name="notes"]');
    const saveButton = form.querySelector<HTMLButtonElement>(".oe-video-modal-save");
    const errorBox = form.querySelector<HTMLElement>(".oe-video-modal-error");
    if (!titleInput || !minutesInput || !notesInput || !saveButton || !errorBox) return;

    const title = titleInput.value.trim();
    const durationMinutes = Math.max(
      1,
      Math.min(720, Math.round(Number(minutesInput.value) || 1)),
    );
    const notes = notesInput.value.trim();
    if (!title) return;

    saveButton.disabled = true;
    errorBox.hidden = true;
    try {
      await saveTrainingMetadata(video.id, { title, durationMinutes, notes });
      await updateTrainingState(video.id, title, durationMinutes);
      closeVideoModal();
      await onUpdated();
    } catch (error) {
      saveButton.disabled = false;
      errorBox.hidden = false;
      errorBox.textContent =
        error instanceof Error ? error.message : "Não foi possível atualizar o vídeo.";
    }
  });

  modal.append(head, form);
  backdrop.append(modal);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) closeVideoModal();
  });
  document.body.append(backdrop);
  window.setTimeout(() => form.querySelector<HTMLInputElement>('input[name="title"]')?.focus(), 0);
}

let trainingRefreshInProgress = false;
let lastTrainingSignature = "";

async function enhanceTrainingRows(force = false) {
  if (!location.pathname.includes("treinamento")) return;
  if (trainingRefreshInProgress) return;
  if (document.getElementById("oe-video-modal-backdrop") && !force) return;

  const section = getTrainingSection();
  if (!section) return;

  trainingRefreshInProgress = true;
  try {
    const [envelope, metadata] = await Promise.all([
      fetchPortalState(),
      fetchTrainingMetadata(),
    ]);
    const training = Array.isArray(envelope.state?.training)
      ? (envelope.state?.training as TrainingItem[])
      : [];
    const signature = JSON.stringify({
      training: training.map((video) => ({
        id: video.id,
        title: video.title,
        durationMinutes: video.durationMinutes,
      })),
      metadata: metadata.videos,
    });
    if (!force && signature === lastTrainingSignature) return;
    lastTrainingSignature = signature;

    document.getElementById("oe-training-editor")?.remove();

    const rows = getVisibleTrainingRows(section);
    rows.forEach((row) => {
      const video = matchVideoForRow(row, training, metadata);
      if (!video) return;

      const saved = metadata.videos[video.id];
      const titleElement = findRowTitleElement(row);
      if (!titleElement) return;

      const currentTitle = saved?.title || video.title;
      if (titleElement.textContent?.trim() !== currentTitle) {
        titleElement.textContent = currentTitle;
      }

      let note = row.querySelector<HTMLElement>(".oe-video-note");
      if (!note) {
        note = document.createElement("div");
        note.className = "oe-video-note";
        titleElement.insertAdjacentElement("afterend", note);
      }
      note.textContent = saved?.notes?.trim() || "";

      let editButton = row.querySelector<HTMLButtonElement>(".oe-video-edit-trigger");
      if (!editButton) {
        editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "oe-video-edit-trigger";
        editButton.textContent = "+";
        editButton.title = "Editar vídeo";
        editButton.setAttribute("aria-label", `Editar ${currentTitle}`);
        const playButton = Array.from(row.querySelectorAll<HTMLButtonElement>("button")).at(-1);
        if (playButton) row.insertBefore(editButton, playButton);
        else row.append(editButton);
      }

      editButton.onclick = () =>
        openVideoModal(video, metadata, async () => {
          lastTrainingSignature = "";
          await enhanceTrainingRows(true);
        });
    });
  } catch {
    // Mantém a experiência principal disponível se a atualização complementar falhar.
  } finally {
    trainingRefreshInProgress = false;
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

let refreshScheduled = false;
function refreshEnhancements() {
  if (refreshScheduled) return;
  refreshScheduled = true;
  window.requestAnimationFrame(() => {
    refreshScheduled = false;
    hardenAdminSearch();
    removeTrainingAreaField();
    void enhanceTrainingRows();
  });
}

export function installRuntimeEnhancements() {
  installRuntimeStyle();
  refreshEnhancements();

  const observer = new MutationObserver(() => refreshEnhancements());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("popstate", refreshEnhancements);
  window.addEventListener("hashchange", refreshEnhancements);
  document.addEventListener("click", () => window.setTimeout(refreshEnhancements, 0));

  window.setInterval(() => {
    if (!document.hidden && location.pathname.includes("treinamento")) {
      void enhanceTrainingRows();
    }
  }, 10_000);
}
