import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { SupportedLanguage } from '@/localization/i18n';

interface SettingsState {
  language: SupportedLanguage;
  /** True once the user has explicitly confirmed a language on the first-launch picker. */
  hasSelectedLanguage: boolean;
  isHydrated: boolean;
  /**
   * Picked on a screen before signing in (Login, registration): that choice wins over the
   * account's saved language at sign-in and is saved to the account — e.g. delivery staff whose
   * account a shop owner made.
   */
  pickedBeforeLogin: boolean;
  setPickedBeforeLogin: (picked: boolean) => void;
  setLanguage: (language: SupportedLanguage) => void;
  confirmLanguage: () => void;
  setHydrated: () => void;
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
      pickedBeforeLogin: false,
      setPickedBeforeLogin: (pickedBeforeLogin) => set({ pickedBeforeLogin }),
      setLanguage: (language) => {
        i18n.changeLanguage(language);
        set({ language });
      },
      confirmLanguage: () => set({ hasSelectedLanguage: true }),
      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // isHydrated must be set via the store's own setHydrated() action (set()), not by
      // mutating `state` directly here — see authStore.ts's identical fix for why a direct
      // mutation bypasses `set()` and can leave subscribers un-notified.
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Rehydrated language preference should also drive the active i18n instance,
          // since i18n itself isn't part of persisted state.
          i18n.changeLanguage(state.language);
          state.setHydrated();
        }
      },
    },
  ),
);
