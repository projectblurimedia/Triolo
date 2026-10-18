import * as Location from 'expo-location';
import { ApiError } from '@/services/apiClient';
import { useLocationStore } from '@/state/locationStore';
import { ensureLocationOn } from './ensureLocationOn';

/** The error every location-gated action fails with; its message comes from `errors.LOCATION_REQUIRED`. */
export const LOCATION_REQUIRED = 'LOCATION_REQUIRED';

/**
 * Every partner action (accepting a job, starting and finishing a trip, handling a shop
 * order…) needs location on. Turns it on if it can (system dialog / Settings) and throws
 * `LOCATION_REQUIRED` otherwise, so the action stops and its usual error toast says why.
 * The shared location state is refreshed either way, so Home's location card stays right.
 */
export async function requireLocation(): Promise<void> {
  const on = await ensureLocationOn();
  useLocationStore
    .getState()
    .refresh()
    .catch(() => undefined);
  if (!on) throw new ApiError(0, 'Location is off', LOCATION_REQUIRED);
}

/**
 * The same check without any dialog — for actions taken from a notification button while
 * the app is closed, where nothing can be shown to turn location on.
 */
export async function isLocationOn(): Promise<boolean> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    return permission.granted && (await Location.hasServicesEnabledAsync());
  } catch {
    return false;
  }
}
