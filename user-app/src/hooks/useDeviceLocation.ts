import { useEffect } from 'react';
import { AppState } from 'react-native';
import { TFunction } from 'i18next';
import { useLocationStore } from '@/state/locationStore';

export type DeviceLocationState =
  | { status: 'loading' }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'disabled' }
  | { status: 'error' }
  | { status: 'ready'; latitude: number; longitude: number };

// One AppState listener for the whole app, however many screens use this hook: whenever the
// app comes back to the foreground, quietly re-check (location may have been turned on or off).
let foregroundListenerAttached = false;
function attachForegroundListener() {
  if (foregroundListenerAttached) return;
  foregroundListenerAttached = true;
  AppState.addEventListener('change', (status) => {
    const { status: locationStatus, refresh } = useLocationStore.getState();
    // Always re-check on return (not only when there was no fix): location may have just been
    // switched OFF, and screens must then stop using the old position.
    if (status === 'active' && locationStatus !== 'loading') {
      refresh();
    }
  });
}

/**
 * The device location shared by every screen (see state/locationStore.ts). `refresh()` is
 * what the screens' Retry buttons call — it may open Settings or the system "turn on
 * location" dialog, since the user asked for it.
 */
export function useDeviceLocation() {
  const status = useLocationStore((state) => state.status);
  const latitude = useLocationStore((state) => state.latitude);
  const longitude = useLocationStore((state) => state.longitude);
  const canAskAgain = useLocationStore((state) => state.canAskAgain);
  const storeRefresh = useLocationStore((state) => state.refresh);

  useEffect(() => {
    attachForegroundListener();
    if (useLocationStore.getState().status === 'idle') storeRefresh();
  }, [storeRefresh]);

  let location: DeviceLocationState;
  if (status === 'ready' && latitude != null && longitude != null) location = { status: 'ready', latitude, longitude };
  else if (status === 'denied') location = { status: 'denied', canAskAgain };
  else if (status === 'disabled') location = { status: 'disabled' };
  else if (status === 'error') location = { status: 'error' };
  else location = { status: 'loading' };

  return {
    location,
    // Retry buttons — may open Settings / the system dialog.
    refresh: () => storeRefresh({ userInitiated: true }),
    // Pull-to-refresh and other background re-checks — never prompts.
    recheck: () => storeRefresh(),
  };
}

/** What the location button will actually do, so its label never lies. */
export function locationActionLabel(location: DeviceLocationState, t: TFunction): string {
  if (location.status === 'disabled') return t('location.turnOn');
  if (location.status === 'denied' && !location.canAskAgain) return t('location.openSettings');
  return t('common.retry');
}
