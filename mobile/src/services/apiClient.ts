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

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  /** internal: prevents infinite refresh loops */
  _retried?: boolean;
}

async function rawRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = (await response.json()) as ApiEnvelope<T> | ApiErrorBody;

  if (!response.ok || !json.success) {
    const errorBody = json as ApiErrorBody;

    // Access token expired mid-session: refresh once, then retry the original call.
    if (response.status === 401 && options.auth && !options._retried) {
      const refreshed = await tryRefreshAccessToken();
      if (refreshed) {
        return rawRequest<T>(path, { ...options, _retried: true });
      }
      useAuthStore.getState().clearSession();
    }

    throw new ApiError(response.status, errorBody.message ?? 'Request failed', errorBody.error?.code);
  }

  return (json as ApiEnvelope<T>).data;
}

/**
 * Multipart uploads (Worker portfolio / Business shop photos) can't go through
 * rawRequest — it always JSON.stringifies the body. Content-Type is deliberately never
 * set here: fetch computes the multipart boundary itself from the FormData instance,
 * and setting the header manually would drop that boundary and break the upload.
 */
async function rawFormRequest<T>(
  path: string,
  formData: FormData,
  method: 'POST' | 'PATCH' = 'POST',
  _retried = false,
): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: formData });
  const json = (await response.json()) as ApiEnvelope<T> | ApiErrorBody;

  if (!response.ok || !json.success) {
    const errorBody = json as ApiErrorBody;

    // These forms can take several minutes to fill out (multi-select chips, photos,
    // location) — the access token frequently expires mid-fill. Mirror rawRequest's
    // refresh-once-and-retry so a stale token doesn't surface as a raw, unmapped
    // "Unauthorized" error at the very end of a long form.
    if (response.status === 401 && !_retried) {
      const refreshed = await tryRefreshAccessToken();
      if (refreshed) {
        return rawFormRequest<T>(path, formData, method, true);
      }
      useAuthStore.getState().clearSession();
    }

    throw new ApiError(response.status, errorBody.message ?? 'Request failed', errorBody.error?.code);
  }

  return (json as ApiEnvelope<T>).data;
}

async function tryRefreshAccessToken(): Promise<boolean> {
  const { refreshToken, setAccessToken } = useAuthStore.getState();
  if (!refreshToken) return false;

  try {
    const data = await rawRequest<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    });
    setAccessToken(data.accessToken);
    useAuthStore.setState({ refreshToken: data.refreshToken });
    return true;
  } catch {
    return false;
  }
}

export const apiClient = {
  get: <T>(path: string, auth = false) => rawRequest<T>(path, { method: 'GET', auth }),
  post: <T>(path: string, body?: unknown, auth = false) => rawRequest<T>(path, { method: 'POST', body, auth }),
  patch: <T>(path: string, body?: unknown, auth = false) => rawRequest<T>(path, { method: 'PATCH', body, auth }),
  delete: <T>(path: string, auth = false) => rawRequest<T>(path, { method: 'DELETE', auth }),
  postForm: <T>(path: string, formData: FormData) => rawFormRequest<T>(path, formData, 'POST'),
  patchForm: <T>(path: string, formData: FormData) => rawFormRequest<T>(path, formData, 'PATCH'),
};
