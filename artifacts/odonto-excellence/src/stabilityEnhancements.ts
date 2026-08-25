const API_URL = (
  import.meta.env.VITE_ODONTO_API_URL ??
  "https://odonto-excellence-api.onrender.com/api"
).replace(/\/$/, "");
const FALLBACK_TOKEN_KEY = "oe-session-fallback-v1";
const FALLBACK_EXPIRY_KEY = "oe-session-fallback-expiry-v1";

type LoginEnvelope = {
  sessionToken?: string;
  expiresAt?: string;
};

type PortalEnvelope = {
  state: Record<string, unknown> | null;
  revision: number;
};

type AppointmentMutation = {
  operation: "upsert" | "delete";
  collaboratorId: string;
  appointmentId?: string;
  appointment?: Record<string, unknown>;
};

const revisionSnapshots = new Map<number, Record<string, unknown>>();
let stateWriteQueue: Promise<unknown> = Promise.resolve();

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
    // HttpOnly cookie remains the primary session mechanism.
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
    return (
      url.origin === new URL(API_URL).origin &&
      url.pathname.includes("/odonto-portal/")
    );
  } catch {
    return false;
  }
}

function isStateEndpoint(url: URL) {
  return url.pathname.endsWith("/odonto-portal/state");
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

function deepEqual(left: unknown, right: unknown) {
  if (left === right) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function identifiedArray(value: unknown): value is Array<Record<string, unknown>> {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        plainObject(item) &&
        typeof item.id === "string" &&
        item.id.length > 0,
    )
  );
}

function mergeIdentifiedArrays(
  base: Array<Record<string, unknown>>,
  desired: Array<Record<string, unknown>>,
  latest: Array<Record<string, unknown>>,
) {
  const baseMap = new Map(base.map((item) => [String(item.id), item]));
  const desiredMap = new Map(desired.map((item) => [String(item.id), item]));
  const latestMap = new Map(latest.map((item) => [String(item.id), item]));
  const order = [
    ...latest.map((item) => String(item.id)),
    ...desired.map((item) => String(item.id)).filter((id) => !latestMap.has(id)),
  ];
  const result: Array<Record<string, unknown>> = [];

  for (const id of order) {
    const baseItem = baseMap.get(id);
    const desiredItem = desiredMap.get(id);
    const latestItem = latestMap.get(id);

    if (!baseItem && !desiredItem && latestItem) {
      result.push(latestItem);
      continue;
    }
    if (baseItem && !desiredItem) {
      // The local user explicitly removed this item. A concurrent edit must not
      // silently resurrect it after the delete action.
      continue;
    }
    if (!baseItem && desiredItem) {
      result.push(latestItem ? mergeThreeWay({}, desiredItem, latestItem) as Record<string, unknown> : desiredItem);
      continue;
    }
    if (baseItem && desiredItem && !latestItem) {
      // Remote deletion wins only when this browser did not change the item.
      if (!deepEqual(baseItem, desiredItem)) result.push(desiredItem);
      continue;
    }
    if (baseItem && desiredItem && latestItem) {
      result.push(mergeThreeWay(baseItem, desiredItem, latestItem) as Record<string, unknown>);
    }
  }
  return result;
}

function mergeThreeWay(base: unknown, desired: unknown, latest: unknown): unknown {
  if (deepEqual(desired, base)) return latest;
  if (deepEqual(latest, base)) return desired;

  if (identifiedArray(base) && identifiedArray(desired) && identifiedArray(latest)) {
    return mergeIdentifiedArrays(base, desired, latest);
  }

  if (Array.isArray(base) && Array.isArray(desired) && Array.isArray(latest)) {
    // Arrays without stable IDs cannot be merged safely by index. The current
    // user's explicit change wins instead of being discarded.
    return desired;
  }

  if (plainObject(base) && plainObject(desired) && plainObject(latest)) {
    const result: Record<string, unknown> = { ...latest };
    const keys = new Set([
      ...Object.keys(base),
      ...Object.keys(desired),
      ...Object.keys(latest),
    ]);
    for (const key of keys) {
      const hasBase = Object.prototype.hasOwnProperty.call(base, key);
      const hasDesired = Object.prototype.hasOwnProperty.call(desired, key);
      const hasLatest = Object.prototype.hasOwnProperty.call(latest, key);

      if (hasBase && !hasDesired) {
        delete result[key];
        continue;
      }
      if (!hasDesired) continue;
      if (!hasBase) {
        result[key] = desired[key];
        continue;
      }
      result[key] = mergeThreeWay(
        base[key],
        desired[key],
        hasLatest ? latest[key] : undefined,
      );
    }
    return result;
  }

  // When both sessions changed the same scalar, keep the action the current
  // user just performed. Unrelated remote fields were already preserved above.
  return desired;
}

function collaboratorList(state: Record<string, unknown>) {
  return Array.isArray(state.collaborators)
    ? state.collaborators.filter(plainObject)
    : [];
}

function withoutAppointments(collaborator: Record<string, unknown>) {
  const { appointments: _appointments, ...rest } = collaborator;
  return rest;
}

function appointmentMap(collaborator: Record<string, unknown>) {
  const items = Array.isArray(collaborator.appointments)
    ? collaborator.appointments.filter(plainObject)
    : [];
  return new Map(
    items
      .filter((item) => typeof item.id === "string")
      .map((item) => [String(item.id), item]),
  );
}

function detectAppointmentMutation(
  base: Record<string, unknown>,
  desired: Record<string, unknown>,
): AppointmentMutation | null {
  const baseTop = { ...base };
  const desiredTop = { ...desired };
  delete baseTop.collaborators;
  delete desiredTop.collaborators;
  if (!deepEqual(baseTop, desiredTop)) return null;

  const before = collaboratorList(base);
  const after = collaboratorList(desired);
  if (before.length !== after.length) return null;
  const beforeById = new Map(before.map((item) => [String(item.id ?? ""), item]));
  const mutations: AppointmentMutation[] = [];

  for (const current of after) {
    const collaboratorId = String(current.id ?? "");
    const previous = beforeById.get(collaboratorId);
    if (!collaboratorId || !previous) return null;
    if (!deepEqual(withoutAppointments(previous), withoutAppointments(current))) return null;

    const oldAppointments = appointmentMap(previous);
    const newAppointments = appointmentMap(current);
    const ids = new Set([...oldAppointments.keys(), ...newAppointments.keys()]);
    for (const id of ids) {
      const oldItem = oldAppointments.get(id);
      const newItem = newAppointments.get(id);
      if (deepEqual(oldItem, newItem)) continue;
      if (newItem) {
        mutations.push({
          operation: "upsert",
          collaboratorId,
          appointment: newItem,
        });
      } else {
        mutations.push({
          operation: "delete",
          collaboratorId,
          appointmentId: id,
        });
      }
    }
  }

  return mutations.length === 1 ? mutations[0] : null;
}

function rememberEnvelope(response: Response) {
  if (!response.ok) return;
  void response
    .clone()
    .json()
    .then((body: PortalEnvelope) => {
      if (!Number.isInteger(body.revision) || !plainObject(body.state)) return;
      revisionSnapshots.set(body.revision, body.state);
      const revisions = [...revisionSnapshots.keys()].sort((a, b) => b - a);
      for (const revision of revisions.slice(8)) revisionSnapshots.delete(revision);
    })
    .catch(() => undefined);
}

function portalHeaders(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
  const token = currentFallbackToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

async function nativeStateFetch(
  nativeFetch: typeof window.fetch,
  input: RequestInfo | URL,
  init: RequestInit,
) {
  const response = await nativeFetch(input, init);
  rememberEnvelope(response);
  return response;
}

async function saveStateSafely(
  nativeFetch: typeof window.fetch,
  input: RequestInfo | URL,
  init: RequestInit,
) {
  const rawBody = typeof init.body === "string" ? init.body : "";
  let payload: { state?: unknown; revision?: unknown };
  try {
    payload = JSON.parse(rawBody) as { state?: unknown; revision?: unknown };
  } catch {
    return nativeFetch(input, init);
  }

  if (!plainObject(payload.state) || !Number.isInteger(payload.revision)) {
    return nativeFetch(input, init);
  }

  const initialRevision = payload.revision as number;
  const base = revisionSnapshots.get(initialRevision);
  const mutation = base ? detectAppointmentMutation(base, payload.state) : null;

  if (mutation) {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    const atomic = await nativeFetch(
      `${API_URL}/odonto-portal/appointments/mutate`,
      {
        ...init,
        method: "POST",
        headers,
        body: JSON.stringify(mutation),
      },
    );
    if (atomic.ok) {
      rememberEnvelope(atomic);
      return atomic;
    }
    // During a staggered deploy an older API may briefly not have the new
    // endpoint yet. Fall through to the conflict-safe document path.
    if (![404, 405, 502, 503, 504].includes(atomic.status)) return atomic;
  }

  let desired = payload.state;
  let baseState = base ?? payload.state;
  let revision = initialRevision;
  let response: Response | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await nativeFetch(input, {
      ...init,
      body: JSON.stringify({ state: desired, revision }),
    });
    if (response.status !== 409) {
      rememberEnvelope(response);
      return response;
    }

    const latestResponse = await nativeFetch(`${API_URL}/odonto-portal/state`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: init.headers,
    });
    if (!latestResponse.ok) return response;
    const latest = (await latestResponse.json()) as PortalEnvelope;
    if (!plainObject(latest.state) || !Number.isInteger(latest.revision)) return response;
    revisionSnapshots.set(latest.revision, latest.state);
    desired = mergeThreeWay(baseState, desired, latest.state) as Record<string, unknown>;
    baseState = latest.state;
    revision = latest.revision;
  }

  return response ?? nativeFetch(input, init);
}

function queueStateWrite(task: () => Promise<Response>) {
  const run = stateWriteQueue.catch(() => undefined).then(task);
  stateWriteQueue = run.then(() => undefined, () => undefined);
  return run;
}

function prewarmPortalApi(nativeFetch: typeof window.fetch) {
  try {
    const apiOrigin = new URL(API_URL).origin;
    for (const rel of ["preconnect", "dns-prefetch"] as const) {
      if (document.querySelector(`link[rel="${rel}"][href="${apiOrigin}"]`)) continue;
      const link = document.createElement("link");
      link.rel = rel;
      link.href = apiOrigin;
      if (rel === "preconnect") link.crossOrigin = "anonymous";
      document.head.append(link);
    }
    void nativeFetch(`${API_URL.replace(/\/api$/, "")}/api/healthz`, {
      method: "GET",
      cache: "no-store",
      mode: "cors",
    }).catch(() => undefined);
  } catch {
    // Warm-up is an optimization only.
  }
}

/**
 * Keeps auth stable, serializes the versioned document writes and resolves
 * concurrent edits without throwing away the user's latest action.
 */
function installFetchStability() {
  if ((window as unknown as { __oeStableFetch?: boolean }).__oeStableFetch) return;
  (window as unknown as { __oeStableFetch?: boolean }).__oeStableFetch = true;
  const nativeFetch = window.fetch.bind(window);
  prewarmPortalApi(nativeFetch);

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
      nextInit.headers = portalHeaders(input, init);
      nextInit.credentials = "include";
      nextInit.cache = init?.cache ?? "no-store";
    }

    const method = (
      nextInit.method ||
      (input instanceof Request ? input.method : "GET")
    ).toUpperCase();

    if (isPortalApi(url) && isStateEndpoint(url) && method === "PUT") {
      return queueStateWrite(() =>
        saveStateSafely(nativeFetch, requestInput, nextInit),
      );
    }

    if (isPortalApi(url) && isStateEndpoint(url) && method === "GET") {
      // Never let an automatic refresh overtake a save already in flight.
      await stateWriteQueue.catch(() => undefined);
    }

    let response: Response | undefined;
    let lastError: unknown;
    const attempts = shouldRetry(url, method) ? 3 : 1;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        response = await nativeStateFetch(nativeFetch, requestInput, nextInit);
        if (!shouldRetry(url, method, response.status)) break;
      } catch (error) {
        lastError = error;
        if (!shouldRetry(url, method)) throw error;
      }
      if (attempt < attempts - 1) await delay(250 * (attempt + 1));
    }

    if (!response) {
      throw lastError instanceof Error ? lastError : new Error("Falha de conexão");
    }

    if (url.pathname.endsWith("/odonto-portal/auth/login-stable") && response.ok) {
      try {
        const body = (await response.clone().json()) as LoginEnvelope;
        if (body.sessionToken) storeFallbackToken(body.sessionToken, body.expiresAt);
      } catch {
        // The login response remains authoritative.
      }
    }

    if (url.pathname.endsWith("/odonto-portal/auth/logout") && response.ok) clearFallbackToken();
    if (response.status === 401 && url.pathname.endsWith("/odonto-portal/auth/me")) clearFallbackToken();

    return response;
  };
}

export function installStabilityEnhancements() {
  installFetchStability();
}
