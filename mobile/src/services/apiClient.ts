import axios, { AxiosError, Method } from 'axios';
import { API_BASE_URL } from '@/constants/config';
import { useAuthStore } from '@/state/authStore';

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
 * axios, not React Native's built-in fetch — matches the networking approach already
 * proven reliable in a sibling project's photo-upload flow (CampuSphere's CreateStudent),
 * after fetch's multipart handling proved flaky for Worker/Business photo uploads in this
 * Expo/RN version. A generous timeout guards a slow/unstable connection (multiple photos
 * over local Wi-Fi to a dev machine) from ever surfacing as a silent, unexplained failure.
 */
const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
  headers: { 'Content-Type': 'application/json' },
});

function toApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const axiosErr = err as AxiosError<ApiErrorBody>;
    if (axiosErr.response) {
      const body = axiosErr.response.data;
      return new ApiError(axiosErr.response.status, body?.message ?? 'Request failed', body?.error?.code);
    }
    // Request never got a response at all — timeout, connection refused, DNS failure.
    return new ApiError(0, axiosErr.message || 'Network request failed');
  }
  return new ApiError(0, err instanceof Error ? err.message : 'Request failed');
}

async function request<T>(
  path: string,
  method: Method,
  body: unknown,
  auth: boolean,
  _retried = false,
): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = {};
  if (auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  try {
    const response = await http.request<ApiEnvelope<T>>({ url: path, method, data: body, headers });
    return response.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 401 && auth && !_retried) {
      const refreshed = await tryRefreshAccessToken();
      if (refreshed) {
        return request<T>(path, method, body, auth, true);
      }
      useAuthStore.getState().clearSession();
    }
    throw toApiError(err);
  }
}

/**
 * Multipart uploads (Worker portfolio / Business shop photos). Content-Type is explicitly
 * `multipart/form-data` with no boundary — React Native's networking layer fills in the
 * boundary itself when it sees this exact header value paired with a FormData body (the
 * same pattern CampuSphere's axios-based upload already relies on).
 */
async function requestForm<T>(
  path: string,
  formData: FormData,
  method: 'post' | 'patch',
  _retried = false,
): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = { 'Content-Type': 'multipart/form-data' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  try {
    const response = await http.request<ApiEnvelope<T>>({ url: path, method, data: formData, headers });
    return response.data.data;
  } catch (err) {
    // These forms can take several minutes to fill out (multi-select chips, photos,
    // location) — the access token frequently expires mid-fill. Refresh once and retry
    // so a stale token doesn't surface as a raw, unmapped "Unauthorized" error at the
    // very end of a long form.
    if (axios.isAxiosError(err) && err.response?.status === 401 && !_retried) {
      const refreshed = await tryRefreshAccessToken();
      if (refreshed) {
        return requestForm<T>(path, formData, method, true);
      }
      useAuthStore.getState().clearSession();
    }
    throw toApiError(err);
  }
}

// Refresh tokens rotate on use (single-use — the backend revokes the old one and issues a
// new pair on every /auth/refresh call). Screens like Profile/Services/Bazaar all fire
// several authenticated queries in parallel (worker profile, business profile, account
// info), so if the access token expires, multiple requests can hit 401 within the same
// instant. Without this dedup, each one would independently call /auth/refresh with the
// SAME still-valid-looking refresh token — only the first to reach the server wins (its
// call rotates the token), and every other concurrent refresh attempt gets its own 401
// (using an already-revoked token), which used to clearSession() and silently log the
// user out mid-flow. Sharing one in-flight promise means only one network call happens;
// every concurrent 401 waits on it and then retries with the token IT obtained.
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
    const response = await http.request<ApiEnvelope<{ accessToken: string; refreshToken: string }>>({
      url: '/auth/refresh',
      method: 'post',
      data: { refreshToken },
    });
    setAccessToken(response.data.data.accessToken);
    useAuthStore.setState({ refreshToken: response.data.data.refreshToken });
    return true;
  } catch {
    return false;
  }
}

export const apiClient = {
  get: <T>(path: string, auth = false) => request<T>(path, 'get', undefined, auth),
  post: <T>(path: string, body?: unknown, auth = false) => request<T>(path, 'post', body, auth),
  patch: <T>(path: string, body?: unknown, auth = false) => request<T>(path, 'patch', body, auth),
  delete: <T>(path: string, auth = false) => request<T>(path, 'delete', undefined, auth),
  postForm: <T>(path: string, formData: FormData) => requestForm<T>(path, formData, 'post'),
  patchForm: <T>(path: string, formData: FormData) => requestForm<T>(path, formData, 'patch'),
};
