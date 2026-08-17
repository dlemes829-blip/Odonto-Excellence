const API_URL = (
  import.meta.env.VITE_ODONTO_API_URL ??
  "https://odonto-excellence-api.onrender.com/api"
).replace(/\/$/, "");

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
    const parsed = JSON.parse(body) as {
      state?: { training?: Array<Record<string, unknown>> };
    };
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

function refineTrainingControls(root: ParentNode = document) {
  root
    .querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="Marcar pendente:"], button[aria-label^="Concluir:"]',
    )
    .forEach((button) => {
      button.disabled = true;
      button.style.pointerEvents = "none";
      button.style.cursor = "default";
      button.setAttribute("aria-label", "Assistido automaticamente");
      button.title = "Vídeo lançado: contabilizado automaticamente como assistido.";
    });

  root.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    if (button.textContent?.replace(/\s+/g, " ").trim() === "Marcar próxima aula") {
      button.remove();
    }
  });
}

function installTrainingUiGuard() {
  refineTrainingControls();
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof Element) refineTrainingControls(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target.closest("button") : null;
      const label = target?.getAttribute("aria-label") ?? "";
      if (
        label === "Assistido automaticamente" ||
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
