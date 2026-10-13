import { Linking } from 'react-native';

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Straight-line (great-circle) distance in meters — free, no routing API involved. */
export function distanceBetween(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Turn-by-turn directions in the Google Maps app (or the browser if it isn't installed).
 * A plain link — not a paid Maps API.
 */
export function openDirections(destination: LatLng): void {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
  Linking.openURL(url).catch(() => {});
}

export function callPhone(mobileNumber: string): void {
  Linking.openURL(`tel:${mobileNumber}`).catch(() => {});
}
