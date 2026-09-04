import React from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '@/state/authStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useThemeStore } from '@/state/themeStore';
import { useThemeColors } from '@/theme';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';
import { LanguageSelectScreen } from '@/screens/auth/LanguageSelectScreen';

export function RootNavigator() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAuthHydrated = useAuthStore((state) => state.isHydrated);
  const hasSelectedLanguage = useSettingsStore((state) => state.hasSelectedLanguage);
  const isSettingsHydrated = useSettingsStore((state) => state.isHydrated);
  const isThemeHydrated = useThemeStore((state) => state.isHydrated);
  const { colors, isDark } = useThemeColors();

  // Wait for persisted state before deciding what to show — avoids a flash of the
  // language picker (or the wrong stack, or the wrong theme) for returning users
  // while AsyncStorage loads.
  if (!isAuthHydrated || !isSettingsHydrated || !isThemeHydrated) {
    return null;
  }

  if (!hasSelectedLanguage) {
    return <LanguageSelectScreen />;
  }

  // NavigationContainer's default theme background is a hardcoded light color —
  // without overriding it, that's what shows through anywhere screen content doesn't
  // fully cover it (e.g. behind the bottom tab bar's rounded corners), regardless of
  // the app's actual light/dark mode. Basing this on the resolved theme fixes that.
  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.error,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      {accessToken ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
