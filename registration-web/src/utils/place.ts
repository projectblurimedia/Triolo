/**
 * A location picked from the browser's GPS or a map pin. `locationName` (village / town) is the
 * only part ever shown; the rest of the address is sent with the profile and never displayed.
 * Same shape as the mobile apps' `utils/place.ts`.
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

interface NominatimAddress {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  hamlet?: string;
  village?: string;
  town?: string;
  city?: string;
  city_district?: string;
  county?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
}

const LOOKUP_TIMEOUT_MS = 8000;

/**
 * Looks up the address for a point with OpenStreetMap's free Nominatim service (browsers have
 * no geocoder of their own). Never throws — an unknown spot still gets a readable name.
 */
export async function placeFromCoords(latitude: number, longitude: number): Promise<PlaceValue> {
  let address: NominatimAddress = {};
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
    const url =
      'https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=16&accept-language=en' +
      `&lat=${latitude}&lon=${longitude}`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) address = ((await response.json()) as { address?: NominatimAddress }).address ?? {};
  } catch {
    // Offline or the lookup failed: keep the point; the name falls back below.
  }
  const settlement = address.village ?? address.hamlet ?? address.town ?? address.city;
  const area = address.suburb ?? address.neighbourhood ?? address.city_district;
  const name =
    [area && area !== settlement ? area : undefined, settlement].filter(Boolean).join(', ') ||
    address.county ||
    address.state_district ||
    'Pinned location';
  const pincode = (address.postcode ?? '').replace(/\s/g, '');
  return {
    latitude,
    longitude,
    locationName: name,
    area: area ?? address.road,
    city: settlement ?? address.county,
    district: address.state_district ?? address.county,
    state: address.state,
    pincode: /^[0-9]{6}$/.test(pincode) ? pincode : undefined,
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
