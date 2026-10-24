import * as Location from 'expo-location';
import i18n from '@/localization/i18n';

/**
 * A location picked from GPS or a map pin. `locationName` (the village / town / locality) is the
 * only part ever shown to anyone; the rest of the reverse-geocoded address is stored with the
 * profile in the background (search, admin records) and never displayed.
 */
export interface PlaceValue {
  latitude: number;
  longitude: number;
  locationName: string;
  area?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
}

// Google's geocoder often returns a Plus Code ("7JCM+2X") as the place's `name` — never show that.
const PLUS_CODE = /\b[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,3}\b/gi;

/** A readable address part, or undefined for blanks, Plus Codes and bare numbers (pincodes). */
export function clean(value: string | null | undefined): string | undefined {
  // "7JCM+2X Kannapuram" keeps "Kannapuram"; a bare code or number is dropped.
  const text = (value ?? '')
    .trim()
    .replace(PLUS_CODE, '')
    .replace(/^[\s,]+|[\s,]+$/g, '')
    .trim();
  if (!text || /^[0-9\s,-]+$/.test(text)) return undefined;
  return text;
}

/** Looks up the address for a point. Never throws — an unknown spot still gets a readable name. */
export async function placeFromCoords(latitude: number, longitude: number): Promise<PlaceValue> {
  let found: Location.LocationGeocodedAddress | undefined;
  try {
    [found] = await Location.reverseGeocodeAsync({ latitude, longitude });
  } catch {
    // Offline or no geocoder: keep the point; the name falls back below.
  }
  // Android maps locality → `city` (the village or town) and subLocality → `district` (an area
  // inside a town); in a village there is usually no subLocality.
  const locality = clean(found?.city);
  const subLocality = clean(found?.district);
  const districtName = clean(found?.subregion);
  const name =
    [subLocality && subLocality !== locality ? subLocality : undefined, locality].filter(Boolean).join(', ') ||
    districtName ||
    clean(found?.name) ||
    clean(found?.region) ||
    i18n.t('location.pinnedPlace');
  const pincode = (found?.postalCode ?? '').trim();
  return {
    latitude,
    longitude,
    locationName: name,
    area: subLocality ?? clean(found?.street),
    city: locality ?? districtName,
    district: districtName,
    state: clean(found?.region),
    pincode: /^[0-9]{6}$/.test(pincode) ? pincode : undefined,
  };
}

/** The stored parts of a profile's location, back into a PlaceValue (null when it has no point). */
export function placeFromProfile(profile: {
  latitude: number | null;
  longitude: number | null;
  locationName?: string | null;
  area?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  pincode?: string | null;
}): PlaceValue | null {
  if (profile.latitude == null || profile.longitude == null) return null;
  return {
    latitude: profile.latitude,
    longitude: profile.longitude,
    locationName: profile.locationName || profile.city || i18n.t('location.pinnedPlace'),
    area: profile.area ?? undefined,
    city: profile.city ?? undefined,
    district: profile.district ?? undefined,
    state: profile.state ?? undefined,
    pincode: profile.pincode ?? undefined,
  };
}

/** Adds a place to a profile's multipart body. */
export function appendPlace(formData: FormData, place: PlaceValue): void {
  formData.append('latitude', String(place.latitude));
  formData.append('longitude', String(place.longitude));
  formData.append('locationName', place.locationName);
  for (const key of ['area', 'city', 'district', 'state', 'pincode'] as const) {
    const value = place[key];
    if (value) formData.append(key, value);
  }
}
