import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/state/authStore';

/**
 * Client-side gate only, for a decent redirect experience — the actual enforcement is
 * server-side `authorize('admin')` on every `/admin/*` backend route (see
 * docs/api-guidelines.md's "server-side, not just UI-hidden" rule). A non-admin or logged-
 * out visitor is bounced to the login page rather than shown an empty/broken dashboard.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const account = useAuthStore((s) => s.account);
  const accessToken = useAuthStore((s) => s.accessToken);

  if (!accessToken || account?.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
