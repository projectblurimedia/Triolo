import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { create } from 'zustand';

export type DeviceLocationStatus = 'idle' | 'loading' | 'denied' | 'disabled' | 'error' | 'ready';

interface LocationState {
  status: DeviceLocationStatus;
  latitude: number | null;
  longitude: number | null;
  /** False once the user has permanently denied permission — Retry then opens Settings. */
  canAskAgain: boolean;
  /**
   * `userInitiated` = the user tapped Retry: only then may this open Settings or pop the
   * system "turn on location" dialog. Automatic checks (mount, app foregrounded) never do,
   * so a declined dialog doesn't keep reappearing.
   */
  refresh: (options?: { userInitiated?: boolean }) => Promise<void>;
}

const FIX_TIMEOUT_MS = 15000;
const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

let inFlight: Promise<void> | null = null;

/**
 * One device location for the whole app (Home, Services, …). Previously each screen held its
 * own copy, so tapping Retry on one screen didn't update the other until it remounted — and
 * Retry couldn't do anything when location services were simply switched off. Now:
 *  - permission permanently denied → Retry opens the app's Settings page
 *  - location services off (Android) → Retry pops the system "turn on location" dialog
 *  - a recent last-known fix is used immediately; otherwise a balanced-accuracy fix
 * Concurrent refreshes share one request. `useDeviceLocation` also re-runs this when the app
 * returns to the foreground, so turning location on in Settings recovers by itself.
 */
export const useLocationStore = create<LocationState>((set, get) => ({
  status: 'idle',
  latitude: null,
  longitude: null,
  canAskAgain: true,
  refresh: (options) => {
    if (inFlight) return inFlight;
    const userInitiated = options?.userInitiated ?? false;
    inFlight = (async () => {
      const hadFix = get().status === 'ready';
      if (!hadFix) set({ status: 'loading' });
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) {
          if (!permission.canAskAgain) {
            // The OS won't show the prompt again — the only way forward is Settings.
            if (userInitiated) await Linking.openSettings();
            set({ status: 'denied', canAskAgain: false });
            return;
          }
          permission = await Location.requestForegroundPermissionsAsync();
          if (!permission.granted) {
            set({ status: 'denied', canAskAgain: permission.canAskAgain });
            return;
          }
        }

        if (!(await Location.hasServicesEnabledAsync())) {
          if (Platform.OS === 'android' && userInitiated) {
            try {
              // Shows Android's own "Turn on location?" dialog; rejects if the user declines.
              await Location.enableNetworkProviderAsync();
            } catch {
              // Declined — fall through to the check below.
            }
          }
          if (!(await Location.hasServicesEnabledAsync())) {
            if (!hadFix) set({ status: 'disabled' });
            return;
          }
        }

        const position =
          (await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS })) ??
          (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), FIX_TIMEOUT_MS));
        set({ status: 'ready', latitude: position.coords.latitude, longitude: position.coords.longitude, canAskAgain: true });
      } catch {
        if (!hadFix) set({ status: 'error' });
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  },
}));
