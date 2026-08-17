const API_URL = (import.meta.env.VITE_ODONTO_API_URL ?? "https://odonto-excellence-api.onrender.com/api").replace(/\/$/, "");
const FALLBACK_TOKEN_KEY = "oe-session-fallback-v1";
const FALLBACK_EXPIRY_KEY = "oe-session-fallback-expiry-v1";

type LoginEnvelope = {
  sessionToken?: string;
  expiresAt?: string;
};

function currentFallbackToken() {
  try {
    const token = sessionStorage.getItem(FALLBACK_TOKEN_KEY);
    const expiry = sessionStorage.getItem(FALLBACK_EXPIRY_KEY);
    if (!token) return null;
    if (expiry && new Date(expiry).getTime() <= Date.now()) {
      sessionStorage.removeItem(FALLBACK_TOKEN_KEY);
      sessionStorage.removeItem(FALLBACK_EXPIRY_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

function storeFallbackToken(token: string, expiresAt?: string) {
  try {
    sessionStorage.setItem(FALLBACK_TOKEN_KEY, token);
    if (expiresAt) sessionStorage.setItem(FALLBACK_EXPIRY_KEY, expiresAt);
  } catch {
    // Safari private mode may reject storage. The HttpOnly cookie remains primary.
  }
}

function clearFallbackToken() {
  try {
    sessionStorage.removeItem(FALLBACK_TOKEN_KEY);
    sessionStorage.removeItem(FALLBACK_EXPIRY_KEY);
  } catch {
    // no-op
  }
}

function isPortalApi(url: URL) {
  try {
    return url.origin === new URL(API_URL).origin && url.pathname.includes("/odonto-portal/");
  } catch {
    return false;
  }
}

function shouldRetry(url: URL, method: string, status?: number) {
  if (method !== "GET") return false;
  const transient = status === undefined || [502, 503, 504].includes(status);
  if (!transient) return false;
  return (
    url.pathname.endsWith("/odonto-portal/auth/me") ||
    url.pathname.endsWith("/odonto-portal/state") ||
    url.pathname.endsWith("/odonto-portal/hierarchy/me")
  );
}

async function delay(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Keeps the HttpOnly cookie as the primary auth mechanism. When iOS/Safari
 * refuses to persist a cross-origin cookie, the same opaque server-side session
 * token is kept only for the lifetime of the browser tab and sent as Bearer.
 * Refreshing the page therefore no longer looks like a logout.
 */
function installFetchStability() {
  if ((window as unknown as { __oeStableFetch?: boolean }).__oeStableFetch) return;
  (window as unknown as { __oeStableFetch?: boolean }).__oeStableFetch = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const originalUrl = input instanceof Request ? input.url : String(input);
    let url = new URL(originalUrl, window.location.href);
    let requestInput: RequestInfo | URL = input;
    const nextInit: RequestInit = { ...init };

    if (url.pathname.endsWith("/odonto-portal/auth/login")) {
      url = new URL(url.toString());
      url.pathname = url.pathname.replace(/\/auth\/login$/, "/auth/login-stable");
      requestInput = url.toString();
    }

    if (isPortalApi(url)) {
      const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
      const token = currentFallbackToken();
      if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
      nextInit.headers = headers;
      nextInit.credentials = "include";
      nextInit.cache = init?.cache ?? "no-store";
    }

    const method = (nextInit.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    let response: Response | undefined;
    let lastError: unknown;
    const attempts = shouldRetry(url, method) ? 3 : 1;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        response = await nativeFetch(requestInput, nextInit);
        if (!shouldRetry(url, method, response.status)) break;
      } catch (error) {
        lastError = error;
        if (!shouldRetry(url, method)) throw error;
      }
      if (attempt < attempts - 1) await delay(350 * (attempt + 1));
    }

    if (!response) throw lastError instanceof Error ? lastError : new Error("Falha de conexão");

    if (url.pathname.endsWith("/odonto-portal/auth/login-stable") && response.ok) {
      try {
        const body = (await response.clone().json()) as LoginEnvelope;
        if (body.sessionToken) storeFallbackToken(body.sessionToken, body.expiresAt);
      } catch {
        // The login response itself remains authoritative even if fallback storage fails.
      }
    }

    if (url.pathname.endsWith("/odonto-portal/auth/logout") && response.ok) clearFallbackToken();
    if (response.status === 401 && url.pathname.endsWith("/odonto-portal/auth/me")) clearFallbackToken();

    return response;
  };
}

/**
 * The core app already polls the authoritative database every 20 seconds.
 * Tighten only that specific cadence to 8 seconds. Other timers keep their
 * original periods, including heartbeats and notifications.
 */
function installRefreshCadence() {
  if ((window as unknown as { __oeStableTimers?: boolean }).__oeStableTimers) return;
  (window as unknown as { __oeStableTimers?: boolean }).__oeStableTimers = true;
  const nativeSetInterval = window.setInterval.bind(window);
  window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const adjusted = timeout === 20_000 ? 8_000 : timeout;
    return nativeSetInterval(handler, adjusted, ...args);
  }) as typeof window.setInterval;
}

export function installStabilityEnhancements() {
  installFetchStability();
  installRefreshCadence();
}
