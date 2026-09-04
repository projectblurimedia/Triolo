import React from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '@/state/authStore';
import { useThemeStore } from '@/state/themeStore';
import { useThemeColors } from '@/theme';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';

/**
 * No first-launch language picker here (unlike user-app) — this app skips that chrome
 * for a leaner, minimal first pass; the device locale (via i18n.ts) still drives en/te
 * automatically, and an account's saved `preferredLanguage` still overrides it on login
 * (see authStore.setSession) once one exists.
 */
export function RootNavigator() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAuthHydrated = useAuthStore((state) => state.isHydrated);
  const isThemeHydrated = useThemeStore((state) => state.isHydrated);
  const { colors, isDark } = useThemeColors();

  if (!isAuthHydrated || !isThemeHydrated) {
    return null;
  }

  // NavigationContainer's default theme background is hardcoded light — without
  // overriding it, that shows through anywhere screen content doesn't fully cover it,
  // regardless of the app's actual light/dark mode.
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
      {accessToken ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
