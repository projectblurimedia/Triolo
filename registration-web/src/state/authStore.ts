import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AccountRole = 'user' | 'worker' | 'business_owner' | 'business_staff' | 'admin';

export interface AuthAccount {
  id: string;
  fullName: string;
  mobileNumber: string;
  email: string | null;
  role: AccountRole;
  status: string;
  preferredLanguage: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  account: AuthAccount | null;
  setSession: (params: { accessToken: string; refreshToken: string; account: AuthAccount }) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
}

/**
 * Session lives in localStorage for both the admin dashboard (persistent across visits)
 * and public registration (harmless if it persists — lets someone reopen their own
 * registration link later and see their status). See .cloud/architecture.md.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      account: null,
      setSession: (params) => set(params),
      setAccessToken: (accessToken) => set({ accessToken }),
      clearSession: () => set({ accessToken: null, refreshToken: null, account: null }),
    }),
    {
      name: 'triolo-web-auth',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
