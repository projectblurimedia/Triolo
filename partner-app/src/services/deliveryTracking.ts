import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { shopOrdersService } from '@/services/shopOrdersService';
import { ApiError } from '@/services/apiClient';
import { useAuthStore } from '@/state/authStore';

/*
 * The shop owner delivering an order himself: shares his position every few seconds so the
 * customer sees the delivery coming on a map — also while the app is minimised (the same
 * foreground-service way as a worker's trip, see tripTracking.ts). Starts when the owner sends
 * it out himself (or opens the order while it's on its way with him), stops on handover.
 */

export const DELIVERY_LOCATION_TASK = 'DELIVERY-LOCATION-TASK';
const ACTIVE_DELIVERY_KEY = 'triolo.activeOwnerDeliveryOrderId';
const UPDATE_INTERVAL_MS = 8000;
const UPDATE_DISTANCE_M = 15;
/** The delivery is over (handed over, cancelled, given to staff) — stop sending. */
const OVER_CODES = ['DELIVERY_NOT_ACTIVE', 'ORDER_NOT_FOUND'];

async function ensureAuthReady(): Promise<string | null> {
  if (!useAuthStore.persist.hasHydrated()) {
    await useAuthStore.persist.rehydrate();
  }
  return useAuthStore.getState().accessToken;
}

async function send(orderId: string, latitude: number, longitude: number): Promise<void> {
  try {
    await shopOrdersService.updateDeliveryLocation(orderId, latitude, longitude);
  } catch (err) {
    if (err instanceof ApiError && err.code && OVER_CODES.includes(err.code)) await stopDeliveryTracking();
  }
}

// Module scope, imported first in index.ts (Android may run it with no screen open).
TaskManager.defineTask(DELIVERY_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const latest = locations?.[locations.length - 1];
  if (!latest) return;
  const orderId = await AsyncStorage.getItem(ACTIVE_DELIVERY_KEY);
  if (!orderId) {
    await stopDeliveryTracking();
    return;
  }
  if (!(await ensureAuthReady())) return;
  await send(orderId, latest.coords.latitude, latest.coords.longitude);
});

/** Starts sharing for this order (must be called with the app open, e.g. on a button press). */
export async function startDeliveryTracking(orderId: string, notification: { title: string; body: string }): Promise<boolean> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return false;
  await AsyncStorage.setItem(ACTIVE_DELIVERY_KEY, orderId);
  if (!(await Location.hasStartedLocationUpdatesAsync(DELIVERY_LOCATION_TASK))) {
    await Location.startLocationUpdatesAsync(DELIVERY_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: UPDATE_INTERVAL_MS,
      distanceInterval: UPDATE_DISTANCE_M,
      pausesUpdatesAutomatically: false,
      foregroundService: { notificationTitle: notification.title, notificationBody: notification.body, notificationColor: '#16A34A' },
    });
  }
  try {
    const now =
      (await Location.getLastKnownPositionAsync({ maxAge: 60_000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    await send(orderId, now.coords.latitude, now.coords.longitude);
  } catch {
    // The background updates follow shortly.
  }
  return true;
}

export async function stopDeliveryTracking(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_DELIVERY_KEY);
  try {
    if (await Location.hasStartedLocationUpdatesAsync(DELIVERY_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(DELIVERY_LOCATION_TASK);
    }
  } catch {
    // Not running.
  }
}

export async function isTrackingDelivery(orderId: string): Promise<boolean> {
  try {
    const active = await AsyncStorage.getItem(ACTIVE_DELIVERY_KEY);
    return active === orderId && (await Location.hasStartedLocationUpdatesAsync(DELIVERY_LOCATION_TASK));
  } catch {
    return false;
  }
}
