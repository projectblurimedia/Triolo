import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/state/authStore';

/** Every page but /login needs a signed-in business (any Triolo account). */
export function RequireLogin({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const location = useLocation();
  if (!accessToken) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
