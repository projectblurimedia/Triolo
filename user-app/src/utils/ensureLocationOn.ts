import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import i18n from '@/localization/i18n';
import { useLocationStore } from '@/state/locationStore';
import { chosenAddressCoords } from '@/state/addressStore';
import { showToast } from '@/state/toastStore';

/*
 * (Copied between user-app and partner-app — keep in sync.)
 *
 * Every action that needs location asks for it FIRST — before any spinner, "searching…" or
 * ad — so the person is never shown work that's about to stop for want of location.
 */

let asking: Promise<boolean> | null = null;

/**
 * Asks for permission if needed, pops Android's own "turn on location" dialog if location is
 * switched off, and opens Settings when permission was permanently denied. Resolves true only
 * when location is actually on and allowed. Quick when it already is (two system checks, no
 * position fix). A second tap while the dialog is up waits for the same answer.
 */
export function ensureLocationOn(): Promise<boolean> {
  // A saved address is chosen: everything works from it, without the phone's location.
  if (chosenAddressCoords()) return Promise.resolve(true);
  if (asking) return asking;
  asking = (async () => {
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) {
        if (!permission.canAskAgain) {
          await Linking.openSettings();
          return false;
        }
        permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) return false;
      }
      if (await Location.hasServicesEnabledAsync()) return true;
      if (Platform.OS === 'android') {
        try {
          await Location.enableNetworkProviderAsync();
        } catch {
          // Declined the dialog.
        }
      }
      return await Location.hasServicesEnabledAsync();
    } catch {
      return false;
    } finally {
      asking = null;
    }
  })();
  return asking;
}

/** `ensureLocationOn`, plus the "Turn on location" message when it's still off. */
export async function askForLocation(): Promise<boolean> {
  const on = await ensureLocationOn();
  // Screens that list what's near you read the shared position: update it straight away.
  if (on) {
    useLocationStore
      .getState()
      .refresh()
      .catch(() => undefined);
  }
  if (!on) {
    showToast({ variant: 'error', title: i18n.t('location.requiredTitle'), message: i18n.t('location.requiredMessage') });
  }
  return on;
}

/** Runs `action` only once location is on (asking first); otherwise says why and stops. */
export function withLocation(action: () => void): void {
  askForLocation().then((on) => {
    if (on) action();
  });
}
