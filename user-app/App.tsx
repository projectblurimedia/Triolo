import '@/localization/i18n';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import * as NavigationBar from 'expo-navigation-bar';
import * as Updates from 'expo-updates';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { RootNavigator } from '@/navigation/RootNavigator';
import { LogoutOverlay } from '@/components/LogoutOverlay';
import { UpdateOverlay } from '@/components/UpdateOverlay';
import { ToastHost } from '@/components/ToastHost';
import { useThemeColors } from '@/theme';
import { useAuthStore } from '@/state/authStore';

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync();

// React Query has no built-in idea of React Native's app foreground/background state (its
// default `refetchOnWindowFocus` relies on a browser `focus` event that doesn't exist here)
// — wiring AppState into `focusManager` makes "app came back to the foreground" count as a
// focus event, so any still-mounted query auto-refetches on foreground per React Query's
// own default behavior (e.g. Profile's Worker/Business profile queries picking up an
// admin's edit/verification change without needing a full app relaunch). Same fix applied
// to partner-app's identical App.tsx for the same reason — see that file's own comment.
function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  const { colors, isDark } = useThemeColors();
  const isLoggingOut = useAuthStore((state) => state.isLoggingOut);

  // OTA updates (EAS Update) — checked periodically and whenever the app returns to the
  // foreground, so a shipped JS/asset change reaches an already-installed build without a
  // new APK/store release. `expo-updates` gives no real byte-level download progress
  // through its JS API, so `downloadProgress` is a simulated ramp (5% → 88%) for the
  // duration of `isDownloading`, snapped to 100% once the update is actually pending, then
  // `reloadAsync()` applies it after a short beat so the "Update Complete" state is visible.
  const { isUpdateAvailable, isUpdatePending, isDownloading } = Updates.useUpdates();
  const [showUpdateOverlay, setShowUpdateOverlay] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!isUpdateAvailable) return;
    setShowUpdateOverlay(true);
    setDownloadProgress(0);
    Updates.fetchUpdateAsync().catch(() => setShowUpdateOverlay(false));
  }, [isUpdateAvailable]);

  useEffect(() => {
    if (!isDownloading) return;
    let current = 0.05;
    setDownloadProgress(current);
    const id = setInterval(() => {
      current = Math.min(current + Math.random() * 0.1 + 0.04, 0.88);
      setDownloadProgress(current);
    }, 400);
    return () => clearInterval(id);
  }, [isDownloading]);

  useEffect(() => {
    if (!isUpdatePending || !showUpdateOverlay) return;
    setDownloadProgress(1);
    const timeout = setTimeout(() => {
      Updates.reloadAsync().catch(() => {});
    }, 1800);
    return () => clearTimeout(timeout);
  }, [isUpdatePending, showUpdateOverlay]);

  const checkForUpdate = useCallback(async () => {
    if (__DEV__) return;
    try {
      await Updates.checkForUpdateAsync();
    } catch {
      // Offline or the update server is unreachable — silently skip, the app still works
      // fine on whichever version is already installed.
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
      checkForUpdate();
    }
  }, [fontsLoaded, fontError, checkForUpdate]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      onAppStateChange(status);
      if (appState.current !== 'active' && status === 'active') {
        checkForUpdate();
      }
      appState.current = status;
    });
    const interval = setInterval(() => {
      if (appState.current === 'active') checkForUpdate();
    }, UPDATE_CHECK_INTERVAL_MS);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [checkForUpdate]);

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
        {showUpdateOverlay ? <UpdateOverlay progress={downloadProgress} /> : null}
        <ToastHost />
        {/* Always light — the app's persistent top chrome is the blue gradient header,
            so status-bar text/icons need to read against that, not the body theme. */}
        <StatusBar style="light" />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
