import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '@/state/authStore';
import { useSettingsStore } from '@/state/settingsStore';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';
import { LanguageSelectScreen } from '@/screens/auth/LanguageSelectScreen';

export function RootNavigator() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAuthHydrated = useAuthStore((state) => state.isHydrated);
  const hasSelectedLanguage = useSettingsStore((state) => state.hasSelectedLanguage);
  const isSettingsHydrated = useSettingsStore((state) => state.isHydrated);

  // Wait for persisted state before deciding what to show — avoids a flash of the
  // language picker (or the wrong stack) for returning users while AsyncStorage loads.
  if (!isAuthHydrated || !isSettingsHydrated) {
    return null;
  }

  if (!hasSelectedLanguage) {
    return <LanguageSelectScreen />;
  }

  return <NavigationContainer>{accessToken ? <AppNavigator /> : <AuthNavigator />}</NavigationContainer>;
}
