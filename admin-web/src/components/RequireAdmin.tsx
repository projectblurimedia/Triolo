import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/state/authStore';
import { LoadingSpinner } from './LoadingSpinner';

/**
 * Client-side gate only, for a decent redirect experience — the actual enforcement is
 * server-side `authorize('admin')` on every `/admin/*` backend route (see
 * docs/api-guidelines.md's "server-side, not just UI-hidden" rule). A non-admin or logged-
 * out visitor is bounced to the login page rather than shown an empty/broken dashboard.
 *
 * Re-verifies `role` against `GET /auth/me` on every mount instead of trusting the cached
 * `account` in `localStorage` — an account promoted to `admin` (via `backend/scripts/
 * seedAdmin.ts` or a manual promotion) after this browser already logged in once would
 * otherwise carry a stale `role: 'user'` snapshot forever, silently bouncing a real admin
 * back to the login page (or, worse, gating routes on data server-side already disagrees
 * with — the actual reported symptom this was added for: the dashboard rendering as if
 * fine but showing nothing, because the cached identity was never revalidated).
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [status, setStatus] = useState<'checking' | 'ok' | 'denied'>('checking');

  useEffect(() => {
    if (!accessToken) {
      setStatus('denied');
      return;
    }
    let cancelled = false;
    authService
      .me()
      .then((fresh) => {
        if (cancelled) return;
        useAuthStore.setState({ account: fresh });
        setStatus(fresh.role === 'admin' ? 'ok' : 'denied');
      })
      .catch(() => {
        if (!cancelled) setStatus('denied');
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (status === 'checking') {
    return (
      <div className="loading-wrap">
        <LoadingSpinner dark />
      </div>
    );
  }

  if (status === 'denied') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
