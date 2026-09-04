import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeState {
  /** User's choice. Resolution against the device scheme happens in useThemeColors(). */
  mode: ThemeMode;
  isHydrated: boolean;
  setMode: (mode: ThemeMode) => void;
}

/** Localization key for a theme mode's display label — shared by every theme-picker UI. */
export function themeModeLabelKey(mode: ThemeMode): string {
  switch (mode) {
    case 'light':
      return 'settings.themeLight';
    case 'dark':
      return 'settings.themeDark';
    default:
      return 'settings.themeSystem';
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      isHydrated: false,
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isHydrated = true;
        }
      },
    },
  ),
);
