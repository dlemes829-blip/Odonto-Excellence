const API_URL = (
  import.meta.env.VITE_ODONTO_API_URL ??
  'https://odonto-excellence-api.onrender.com/api'
).replace(/\/$/, '');

const AUTH_ME = `${API_URL}/odonto-portal/auth/me`;
const CACHE_TTL_MS = 20_000;

type CachedResponse = {
  body: string;
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
  expiresAt: number;
};

let upstreamFetch: typeof window.fetch | null = null;
let authCache: CachedResponse | null = null;
let authPrewarm: Promise<void> | null = null;

function isAccessRoute() {
  return window.location.pathname === '/acesso';
}

function isPortalUrl(url: URL) {
  try {
    return url.origin === new URL(API_URL).origin && url.pathname.includes('/odonto-portal/');
  } catch {
    return false;
  }
}

function responseFromCache(cache: CachedResponse) {
  return new Response(cache.body, {
    status: cache.status,
    statusText: cache.statusText,
    headers: new Headers(cache.headers),
  });
}

async function rememberAuthResponse(response: Response) {
  try {
    const body = await response.clone().text();
    authCache = {
      body,
      status: response.status,
      statusText: response.statusText,
      headers: Array.from(response.headers.entries()),
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
  } catch {
    authCache = null;
  }
}

function emptyNotifications() {
  return new Response(JSON.stringify({ notifications: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function installPrivateAccessNetworkEnhancements() {
  const marker = window as typeof window & { __controleAccessNetwork?: boolean };
  if (marker.__controleAccessNetwork) return;
  marker.__controleAccessNetwork = true;

  upstreamFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(rawUrl, window.location.href);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();

    if (
      isAccessRoute() &&
      isPortalUrl(url) &&
      url.pathname.includes('/odonto-portal/notifications')
    ) {
      return emptyNotifications();
    }

    if (
      method === 'GET' &&
      url.toString() === AUTH_ME &&
      authCache &&
      authCache.expiresAt > Date.now()
    ) {
      return responseFromCache(authCache);
    }

    const response = await upstreamFetch!(input, init);

    if (method === 'GET' && url.toString() === AUTH_ME) {
      await rememberAuthResponse(response);
    }

    if (
      url.pathname.endsWith('/odonto-portal/auth/login') ||
      url.pathname.endsWith('/odonto-portal/auth/login-stable') ||
      url.pathname.endsWith('/odonto-portal/auth/logout')
    ) {
      authCache = null;
    }

    return response;
  };
}

export function prewarmPrivateSession() {
  if (!upstreamFetch) return Promise.resolve();
  if (authCache && authCache.expiresAt > Date.now()) return Promise.resolve();
  if (authPrewarm) return authPrewarm;

  authPrewarm = upstreamFetch(AUTH_ME, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })
    .then((response) => rememberAuthResponse(response))
    .catch(() => undefined)
    .finally(() => {
      authPrewarm = null;
    });

  return authPrewarm;
}
