import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { SupportedLanguage } from '@/localization/i18n';

interface SettingsState {
  language: SupportedLanguage;
  /** True once the user has explicitly confirmed a language on the first-launch picker. */
  hasSelectedLanguage: boolean;
  isHydrated: boolean;
  setLanguage: (language: SupportedLanguage) => void;
  confirmLanguage: () => void;
}

/** Localization key for a language code's display label — shared by every language-picker UI. */
export function languageLabelKey(language: SupportedLanguage): string {
  return language === 'te' ? 'settings.telugu' : 'settings.english';
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: i18n.language as SupportedLanguage,
      hasSelectedLanguage: false,
      isHydrated: false,
      setLanguage: (language) => {
        i18n.changeLanguage(language);
        set({ language });
      },
      confirmLanguage: () => set({ hasSelectedLanguage: true }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Rehydrated language preference should also drive the active i18n instance,
          // since i18n itself isn't part of persisted state.
          i18n.changeLanguage(state.language);
          state.isHydrated = true;
        }
      },
    },
  ),
);
