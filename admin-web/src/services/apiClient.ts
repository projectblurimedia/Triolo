import { useAuthStore } from '@/state/authStore';

/**
 * Points at the local backend during development, via the same LAN IP the mobile apps use
 * (`user-app`/`partner-app`'s `constants/config.ts`) rather than `localhost` — this site is
 * itself served from that LAN IP (see `vite.config.ts`'s `server.host`) so it can be opened
 * from another device on the network, and `localhost` from that device would mean itself,
 * not the dev machine. Update alongside the mobile apps' `API_BASE_URL` if that IP changes
 * (find it with `ipconfig` on the dev machine — phone and PC must be on the same Wi-Fi
 * network). Override for staging/production once those API URLs exist (see
 * docs/deployment.md).
 */
const API_BASE_URL = 'http://192.168.1.14:4000/api/v1';

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  error?: { code: string; details?: unknown };
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code?: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Simpler than the mobile apps' apiClient — a browser's `fetch`+`FormData` is safe to
 * resend on retry (unlike React Native's), so there's no need for the mobile apps'
 * proactive-JWT-decode refresh dance (see .cloud/architecture.md's "Frontend Structure
 * (web/)"). A plain reactive refresh-once is enough here.
 *
 * Also retries on 403, not just 401 — `authenticate` decodes `role` straight from the
 * access token's own payload (baked in at whichever login minted it), never re-checking the
 * database per-request. An account promoted to `admin` *after* its current token was issued
 * (the realistic path — `backend/scripts/seedAdmin.ts` only runs before someone's first
 * login) keeps hitting `authorize('admin')`'s 403 with every call until it gets a token
 * minted fresh. `POST /auth/refresh` *does* re-read the account from the database and signs
 * the new pair from that (see `AuthService.refreshAccessToken`), so a single silent refresh
 * — the same single-flight `tryRefreshAccessToken()` 401 already uses — fixes this without
 * forcing a disruptive full re-login. If the retry still 403s, the account genuinely isn't
 * `admin` and the error is left to surface normally.
 */
async function request<T>(path: string, init: RequestInit, auth: boolean, retried = false): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const headers = new Headers(init.headers);
  if (auth && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if ((response.status === 401 || response.status === 403) && auth && !retried) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      return request<T>(path, init, auth, true);
    }
    if (response.status === 401) {
      useAuthStore.getState().clearSession();
    }
  }

  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | ApiErrorBody | null;
  if (!response.ok || !body?.success) {
    const errorBody = body as ApiErrorBody | null;
    throw new ApiError(response.status, errorBody?.message ?? 'Request failed', errorBody?.error?.code);
  }
  return (body as ApiEnvelope<T>).data;
}

let refreshPromise: Promise<boolean> | null = null;

function tryRefreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function performRefresh(): Promise<boolean> {
  const { refreshToken, setAccessToken } = useAuthStore.getState();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return false;
    const body = (await response.json()) as ApiEnvelope<{ accessToken: string; refreshToken: string }>;
    setAccessToken(body.data.accessToken);
    useAuthStore.setState({ refreshToken: body.data.refreshToken });
    return true;
  } catch {
    return false;
  }
}

function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };
}

export const apiClient = {
  get: <T>(path: string, auth = false) => request<T>(path, { method: 'GET' }, auth),
  post: <T>(path: string, body?: unknown, auth = false) => request<T>(path, jsonInit('POST', body), auth),
  patch: <T>(path: string, body?: unknown, auth = false) => request<T>(path, jsonInit('PATCH', body), auth),
  delete: <T>(path: string, auth = false) => request<T>(path, { method: 'DELETE' }, auth),
  postForm: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', body: formData }, true),
};
