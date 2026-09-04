import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from './settingsStore';
import { SupportedLanguage } from '@/localization/i18n';

export type AccountRole = 'user' | 'worker' | 'business_owner' | 'business_staff' | 'admin';
export type AccountStatus = 'active' | 'pending_verification' | 'suspended' | 'blocked';
export type AccountLanguage = SupportedLanguage;

export interface AuthAccount {
  id: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  role: AccountRole;
  status: AccountStatus;
  preferredLanguage: AccountLanguage;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  account: AuthAccount | null;
  isHydrated: boolean;
  /** True for the duration of the logout request — drives a full-screen overlay (LogoutOverlay) rendered at the app root. Not persisted: a stuck-true value should never survive a restart. */
  isLoggingOut: boolean;
  setSession: (params: { accessToken: string; refreshToken: string; account: AuthAccount }) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
  setLoggingOut: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      account: null,
      isHydrated: false,
      isLoggingOut: false,
      setSession: ({ accessToken, refreshToken, account }) => {
        set({ accessToken, refreshToken, account });
        // The account's saved language is authoritative on login/registration —
        // it overrides whatever the device's local guess/setting was. See docs/localization.md.
        useSettingsStore.getState().setLanguage(account.preferredLanguage);
      },
      setAccessToken: (accessToken) => set({ accessToken }),
      clearSession: () => set({ accessToken: null, refreshToken: null, account: null }),
      setLoggingOut: (isLoggingOut) => set({ isLoggingOut }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Excludes isLoggingOut only — a stuck `true` surviving an app kill mid-logout
      // would otherwise show the full-screen LogoutOverlay forever on next launch.
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        account: state.account,
        isHydrated: state.isHydrated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isHydrated = true;
        }
      },
    },
  ),
);
