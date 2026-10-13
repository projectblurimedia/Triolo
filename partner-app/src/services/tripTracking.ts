import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { jobsService } from '@/services/jobsService';
import { ApiError } from '@/services/apiClient';
import { useAuthStore } from '@/state/authStore';

export const TRIP_LOCATION_TASK = 'TRIP-LOCATION-TASK';
const ACTIVE_TRIP_KEY = 'triolo.activeTripBookingId';

// Every ~8s or 15m — smooth enough for the customer's map without draining the battery.
const UPDATE_INTERVAL_MS = 8000;
const UPDATE_DISTANCE_M = 15;

/** Codes meaning the trip is over (cancelled, arrived, finished) — stop sending. */
const TRIP_OVER_CODES = ['BOOKING_TRIP_NOT_ACTIVE', 'BOOKING_REQUEST_NOT_FOUND'];

async function ensureAuthReady(): Promise<string | null> {
  // The task can run headlessly (app minimised or its UI gone); make sure the persisted
  // session has been read back before using it.
  if (!useAuthStore.persist.hasHydrated()) {
    await useAuthStore.persist.rehydrate();
  }
  return useAuthStore.getState().accessToken;
}

async function sendLocation(bookingId: string, latitude: number, longitude: number): Promise<void> {
  try {
    await jobsService.updateLocation(bookingId, latitude, longitude);
  } catch (err) {
    if (err instanceof ApiError && err.code && TRIP_OVER_CODES.includes(err.code)) {
      await stopTripTracking();
    }
    // Anything else (a dropped connection) is just skipped; the next update retries.
  }
}

/**
 * Module scope, imported first thing in index.ts — Android delivers locations to this task
 * while the app is minimised (kept alive by the "Trip in progress" foreground-service
 * notification), so it must be defined before any UI code runs.
 */
TaskManager.defineTask(TRIP_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const latest = locations?.[locations.length - 1];
  if (!latest) return;

  const bookingId = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
  if (!bookingId) {
    await stopTripTracking();
    return;
  }
  if (!(await ensureAuthReady())) return;
  await sendLocation(bookingId, latest.coords.latitude, latest.coords.longitude);
});

export interface TripNotificationText {
  title: string;
  body: string;
}

/**
 * Starts sharing this worker's live location for one Quick Book trip. Uses a foreground
 * service (a persistent "Trip in progress" notification), which lets updates continue while
 * the app is minimised — e.g. while the worker navigates in Google Maps — with only the normal
 * "while using the app" location permission. Must be called while the app is open (a
 * button press), which Android requires for starting a foreground service.
 * Returns false if location permission was refused.
 */
export async function startTripTracking(bookingId: string, notification: TripNotificationText): Promise<boolean> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return false;

  await AsyncStorage.setItem(ACTIVE_TRIP_KEY, bookingId);
  if (!(await Location.hasStartedLocationUpdatesAsync(TRIP_LOCATION_TASK))) {
    await Location.startLocationUpdatesAsync(TRIP_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: UPDATE_INTERVAL_MS,
      distanceInterval: UPDATE_DISTANCE_M,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: notification.title,
        notificationBody: notification.body,
        notificationColor: '#0055D3',
      },
    });
  }

  // Send a first point straight away so the customer sees the worker immediately.
  try {
    const now =
      (await Location.getLastKnownPositionAsync({ maxAge: 60_000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    await sendLocation(bookingId, now.coords.latitude, now.coords.longitude);
  } catch {
    // The background updates will follow shortly anyway.
  }
  return true;
}

/** Stops sharing (and removes the "Trip in progress" notification). Safe to call any time. */
export async function stopTripTracking(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TRIP_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(TRIP_LOCATION_TASK);
    }
  } catch {
    // Not running / not on a build with the location task — nothing to stop.
  }
}

/** Whether this exact trip is currently sharing location (e.g. to resume after an app restart). */
export async function isTrackingTrip(bookingId: string): Promise<boolean> {
  try {
    const active = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
    return active === bookingId && (await Location.hasStartedLocationUpdatesAsync(TRIP_LOCATION_TASK));
  } catch {
    return false;
  }
}
