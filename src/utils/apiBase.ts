/**
 * Base URL for FastAPI. Empty string = same origin (Vite dev server proxies /api → backend).
 * Set VITE_API_URL in .env when the API is on another host (e.g. production).
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  if (raw == null || String(raw).trim() === '') {
    return '';
  }
  return String(raw).replace(/\/$/, '');
}

/** Full URL for an API path like `/api/auth/login`. */
export function apiUrl(apiPath: string): string {
  const base = getApiBaseUrl();
  const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  if (!base) {
    return path;
  }
  return `${base}${path}`;
}

const DEFAULT_FETCH_TIMEOUT_MS = 18_000;

/**
 * `fetch` that aborts after `timeoutMs` so a down API cannot leave the UI stuck on "Loading…".
 */
export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    window.clearTimeout(id);
  });
}
