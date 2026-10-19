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

/** The business's session on the Triolo Ads website, kept in localStorage across visits. */
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
      name: 'triolo-ads-auth',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
