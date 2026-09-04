import '@/localization/i18n';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import * as NavigationBar from 'expo-navigation-bar';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from '@/navigation/RootNavigator';
import { LogoutOverlay } from '@/components/LogoutOverlay';
import { ToastHost } from '@/components/ToastHost';
import { useThemeColors } from '@/theme';
import { useAuthStore } from '@/state/authStore';

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  const { colors, isDark } = useThemeColors();
  const isLoggingOut = useAuthStore((state) => state.isLoggingOut);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // The root window background (what shows through the edge-to-edge system nav bar
  // area on Android, since that area isn't part of the React view tree at all) has to
  // be set via this native API — plain component/StyleSheet backgroundColor never
  // reaches it. Synced to colors.surface (not colors.background) specifically so the
  // system back/home/recents bar matches CustomTabBar's own background — the tab bar
  // sits directly above that system area, so a mismatched color read as a visible seam
  // right where they meet. Nav bar button style is synced too so the icons stay visible
  // against either theme, independent of the device's own OS-level light/dark setting.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.surface);
    if (Platform.OS === 'android') {
      NavigationBar.setStyle(isDark ? 'light' : 'dark');
    }
  }, [colors.surface, isDark]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <RootNavigator />
        {isLoggingOut ? <LogoutOverlay /> : null}
        <ToastHost />
        {/* Always light — the app's persistent top chrome is the blue gradient header,
            so status-bar text/icons need to read against that, not the body theme. */}
        <StatusBar style="light" />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
